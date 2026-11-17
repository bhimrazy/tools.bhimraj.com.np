import { EngineError } from "./errors";
import type { CompressOptions, CompressResult, OutputFormat } from "./index";
import {
  capLayout,
  capSize,
  computeLayout,
  MAX_PIXELS,
  pixelBudget,
  scaleLayout,
  type Layout,
  type Rect,
} from "./layout";
import { padJpeg } from "./pad";
import { readImageSize } from "./probe";
import { fitToTarget } from "./search";

/** 1 GiB as RGBA: no phone browser decodes this, so fail fast instead of crashing the tab. */
const MAX_SOURCE_PIXELS = 2 ** 28;
/** Downscaling never shrinks the shorter side below this. */
const MIN_SIDE = 64;
/** Reaches the JPEG SOF marker past typical EXIF and ICC segments. */
const HEADER_BYTES = 256 * 1024;

type Canvas = OffscreenCanvas | HTMLCanvasElement;
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

const unsupported = () =>
  new EngineError("unsupported_browser", "This browser can't process images");

function surface(width: number, height: number): [Canvas, Context] {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx) return [canvas, ctx];
  }
  // iOS < 16.4 has no OffscreenCanvas; the engine then runs this on the main thread.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) return [canvas, ctx];
  }
  throw unsupported();
}

function toBlob(canvas: Canvas, type: string, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new EngineError("internal", "Could not encode the image")),
      type,
      quality,
    ),
  );
}

/** Frees the backing store now instead of waiting for GC. */
function release(canvas: Canvas | undefined) {
  if (canvas) canvas.width = canvas.height = 0;
}

const whole = (b: ImageBitmap): Rect => ({
  x: 0,
  y: 0,
  w: b.width,
  h: b.height,
});

/** Crops `r` out of `src` and scales it to w×h. */
async function crop(
  src: ImageBitmap,
  r: Rect,
  w: number,
  h: number,
): Promise<ImageBitmap> {
  const out = await createImageBitmap(src, r.x, r.y, r.w, r.h, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: "high",
  });
  if (out.width === w && out.height === h) return out;
  // Engines that ignore resize options return the crop unscaled; scale it on a canvas.
  out.close();
  const [canvas, ctx] = surface(w, h);
  try {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, w, h);
    return await createImageBitmap(canvas);
  } finally {
    release(canvas);
  }
}

/**
 * Decodes at most `budget` pixels. The header gives the size up front, so large images decode
 * straight to the capped size instead of holding a full-size copy (50 MP ≈ 200 MB) first.
 * EXIF orientation is applied: `imageOrientation` is left at its default, since engines that only
 * know the old enum reject "from-image".
 */
async function decode(file: Blob, budget: number): Promise<ImageBitmap> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const size = readImageSize(head);
  if (size && size.width * size.height > MAX_SOURCE_PIXELS)
    throw new EngineError("too_large", "This image has too many pixels");
  const capped =
    size && size.width * size.height > budget
      ? capSize(size.width, size.height, budget)
      : undefined;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      file,
      capped
        ? {
            resizeWidth: capped.width,
            resizeHeight: capped.height,
            resizeQuality: "high",
          }
        : {},
    );
  } catch (err) {
    throw new EngineError("decode_failed", "This file couldn't be decoded", {
      cause: err,
    });
  }
  // Unknown header, or an engine that ignored the resize options.
  const fit = capSize(bitmap.width, bitmap.height, budget);
  if (fit.width === bitmap.width && fit.height === bitmap.height) return bitmap;
  try {
    return await crop(bitmap, whole(bitmap), fit.width, fit.height);
  } finally {
    bitmap.close();
  }
}

function render(
  bitmap: ImageBitmap,
  layout: Layout,
  background: string,
): Canvas {
  const [canvas, ctx] = surface(layout.width, layout.height);
  // Invalid colours are ignored by fillStyle, so white stays as the fallback.
  ctx.fillStyle = "#ffffff";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const { dst } = layout;
  ctx.drawImage(bitmap, dst.x, dst.y, dst.w, dst.h);
  return canvas;
}

interface Encoding {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
}

const deviceMemory = () =>
  (globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory;

export async function compressImage(
  file: Blob,
  opts: CompressOptions,
  signal?: AbortSignal,
): Promise<CompressResult> {
  signal?.throwIfAborted();
  if (typeof createImageBitmap === "undefined") throw unsupported();
  for (const side of [opts.width, opts.height]) {
    if (side !== undefined && !(side >= 1 && Number.isFinite(side)))
      throw new RangeError("width/height must be ≥ 1");
  }
  const width = opts.width && Math.round(opts.width);
  const height = opts.height && Math.round(opts.height);
  const background = opts.background ?? "#ffffff";
  const minBytes = opts.minBytes ?? 0;
  let format: OutputFormat = opts.format ?? "image/jpeg";
  // Explicit dimensions are a requirement (e.g. a portal's photo size), so only free-size jobs shrink.
  const fixedSize = Boolean(width || height);

  const source = await decode(file, pixelBudget(deviceMemory()));
  let image = source;
  let canvas: Canvas | undefined;
  try {
    signal?.throwIfAborted();
    const base = capLayout(
      computeLayout(source.width, source.height, {
        ...(width && { width }),
        ...(height && { height }),
        ...(opts.fit && { fit: opts.fit }),
      }),
      MAX_PIXELS,
    );
    const { src, dst } = base;
    const identity =
      src.w === source.width &&
      src.h === source.height &&
      dst.w === src.w &&
      dst.h === src.h;
    if (!identity) {
      // Crop + resize once up front, so later passes work on output-sized pixels and the source can go.
      image = await crop(source, src, dst.w, dst.h);
      source.close();
    }
    const fitted = image;

    let canvasScale = 0;
    const draw = async (scale: number) => {
      if (canvas && scale === canvasScale) return canvas;
      release(canvas);
      const layout = scaleLayout(base, scale);
      if (scale === 1) {
        canvas = render(fitted, layout, background);
        // Fixed-size jobs never redraw, so the canvas is the only copy needed.
        if (fixedSize) fitted.close();
      } else {
        const scaled = await crop(
          fitted,
          whole(fitted),
          layout.dst.w,
          layout.dst.h,
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
      let blob = await toBlob(c, format, quality);
      if (blob.type !== format) {
        // Safari can't encode WebP and silently returns PNG instead.
        if (format === "image/jpeg")
          throw new EngineError(
            "unsupported_browser",
            "This browser can't encode JPEG",
          );
        format = "image/jpeg";
        blob = await toBlob(c, format, quality);
      }
      return {
        blob,
        bytes: blob.size,
        width: c.width,
        height: c.height,
        format,
      };
    };

    const fit = await fitToTarget(encode, {
      maxBytes: opts.maxBytes,
      minBytes,
      ...(signal && { signal }),
      policy: fixedSize ? "fixed" : "free",
      minScale: Math.min(1, MIN_SIDE / Math.min(base.width, base.height)),
    });
    const { width: w, height: h, format: f } = fit.result;
    let { blob } = fit.result;
    // WebP isn't padded: byte minimums come from portals that take JPEG only, and a valid
    // padding chunk would mean rewriting a simple WebP into the extended (VP8X) layout.
    if (blob.size < minBytes && f === "image/jpeg") {
      const padded = padJpeg(
        new Uint8Array(await blob.arrayBuffer()),
        minBytes,
      );
      if (padded.length <= opts.maxBytes)
        blob = new Blob([padded], { type: f });
    }
    return {
      blob,
      bytes: blob.size,
      width: w,
      height: h,
      quality: fit.quality,
      format: f,
      withinTarget: blob.size >= minBytes && blob.size <= opts.maxBytes,
    };
  } finally {
    source.close();
    image.close();
    release(canvas);
  }
}
