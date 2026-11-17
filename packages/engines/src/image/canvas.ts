import type { CompressOptions, CompressResult, OutputFormat } from "./index";
import { computeLayout, scaleLayout, type Layout } from "./layout";
import { fitToTarget } from "./search";

/** iOS Safari refuses canvases larger than this many pixels. */
export const MAX_PIXELS = 16_777_216;
/** Downscaling never shrinks the shorter side below this. */
const MIN_SIDE = 64;

const resize = (w: number, h: number): ImageBitmapOptions => ({
  resizeWidth: w,
  resizeHeight: h,
  resizeQuality: "high",
});

/** Decodes with EXIF orientation applied, shrunk to fit MAX_PIXELS. */
export async function decode(file: Blob): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const area = bitmap.width * bitmap.height;
  if (area <= MAX_PIXELS) return bitmap;
  const k = Math.sqrt(MAX_PIXELS / area);
  try {
    return await createImageBitmap(
      bitmap,
      resize(Math.floor(bitmap.width * k), Math.floor(bitmap.height * k)),
    );
  } finally {
    bitmap.close();
  }
}

export function render(
  bitmap: ImageBitmap,
  layout: Layout,
  background: string,
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a 2D canvas");
  // Invalid colours are ignored by fillStyle, so white stays as the fallback.
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const { dst } = layout;
  ctx.drawImage(bitmap, dst.x, dst.y, dst.w, dst.h);
  return canvas;
}

/** Frees the backing store now instead of waiting for GC. */
function release(canvas: OffscreenCanvas | undefined) {
  if (canvas) canvas.width = canvas.height = 0;
}

interface Encoding {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
}

export async function compressImage(
  file: Blob,
  opts: CompressOptions,
  signal?: AbortSignal,
): Promise<CompressResult> {
  if (
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    throw new Error("This browser can't process images in the background");
  }
  for (const side of [opts.width, opts.height]) {
    if (side !== undefined && !(side >= 1 && Number.isFinite(side)))
      throw new RangeError("width/height must be ≥ 1");
  }
  const width = opts.width && Math.round(opts.width);
  const height = opts.height && Math.round(opts.height);
  const background = opts.background ?? "#ffffff";
  let format: OutputFormat = opts.format ?? "image/jpeg";

  const source = await decode(file);
  let fitted: ImageBitmap | undefined;
  let canvas: OffscreenCanvas | undefined;
  try {
    let base = computeLayout(source.width, source.height, {
      ...(width && { width }),
      ...(height && { height }),
      ...(opts.fit && { fit: opts.fit }),
    });
    base = scaleLayout(
      base,
      Math.min(1, Math.sqrt(MAX_PIXELS / (base.width * base.height))),
    );
    // Crop + resize once up front, so later passes work on output-sized pixels and the source can go.
    const { src, dst } = base;
    fitted = await createImageBitmap(
      source,
      src.x,
      src.y,
      src.w,
      src.h,
      resize(dst.w, dst.h),
    );
    source.close();
    const image = fitted;

    let canvasScale = 0;
    const draw = async (scale: number) => {
      if (canvas && scale === canvasScale) return canvas;
      release(canvas);
      const layout = scaleLayout(base, scale);
      if (scale === 1) {
        canvas = render(image, layout, background);
      } else {
        const scaled = await createImageBitmap(
          image,
          resize(layout.dst.w, layout.dst.h),
        );
        try {
          canvas = render(scaled, layout, background);
        } finally {
          scaled.close();
        }
      }
      canvasScale = scale;
      return canvas;
    };

    const encode = async (
      quality: number,
      scale: number,
    ): Promise<Encoding> => {
      const c = await draw(scale);
      let blob = await c.convertToBlob({ type: format, quality });
      if (blob.type !== format) {
        // Safari can't encode WebP and silently returns PNG instead.
        if (format === "image/jpeg")
          throw new Error("This browser can't encode JPEG");
        format = "image/jpeg";
        blob = await c.convertToBlob({ type: format, quality });
      }
      return {
        blob,
        bytes: blob.size,
        width: c.width,
        height: c.height,
        format,
      };
    };

    // Explicit dimensions are a requirement (e.g. a portal's photo size), so only free-size jobs shrink.
    const fixedSize = Boolean(width || height);
    const fit = await fitToTarget(encode, {
      maxBytes: opts.maxBytes,
      ...(opts.minBytes !== undefined && { minBytes: opts.minBytes }),
      ...(signal && { signal }),
      maxScaleSteps: fixedSize ? 0 : 12,
      minScale: Math.min(1, MIN_SIDE / Math.min(base.width, base.height)),
    });
    const { blob, bytes, width: w, height: h, format: f } = fit.result;
    return {
      blob,
      bytes,
      width: w,
      height: h,
      quality: fit.quality,
      format: f,
      withinTarget: fit.withinTarget,
    };
  } finally {
    source.close();
    fitted?.close();
    release(canvas);
  }
}
