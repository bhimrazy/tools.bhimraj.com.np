export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Output canvas size, the source region to read and where it lands. All integers. */
export interface Layout {
  width: number;
  height: number;
  src: Rect;
  dst: Rect;
}

export interface SizeOptions {
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
}

const px = (n: number) => Math.max(1, Math.round(n));

export function computeLayout(
  srcW: number,
  srcH: number,
  { width, height, fit = "cover" }: SizeOptions,
): Layout {
  const full = { x: 0, y: 0, w: srcW, h: srcH };
  if (width && height) {
    if (fit === "cover") {
      const k = Math.max(width / srcW, height / srcH);
      const w = Math.min(srcW, px(width / k));
      const h = Math.min(srcH, px(height / k));
      const src = {
        x: Math.floor((srcW - w) / 2),
        y: Math.floor((srcH - h) / 2),
        w,
        h,
      };
      return { width, height, src, dst: { x: 0, y: 0, w: width, h: height } };
    }
    const k = Math.min(width / srcW, height / srcH);
    const w = Math.min(width, px(srcW * k));
    const h = Math.min(height, px(srcH * k));
    return {
      width,
      height,
      src: full,
      dst: {
        x: Math.floor((width - w) / 2),
        y: Math.floor((height - h) / 2),
        w,
        h,
      },
    };
  }
  const w = width ?? (height ? px((srcW * height) / srcH) : srcW);
  const h = height ?? (width ? px((srcH * width) / srcW) : srcH);
  return { width: w, height: h, src: full, dst: { x: 0, y: 0, w, h } };
}

export function scaleLayout(
  l: Layout,
  scale: number,
  round = Math.round,
): Layout {
  if (scale === 1) return l;
  const { dst } = l;
  const size = (n: number) => Math.max(1, round(n * scale));
  return {
    width: size(l.width),
    height: size(l.height),
    src: l.src,
    dst: {
      x: Math.round(dst.x * scale),
      y: Math.round(dst.y * scale),
      w: size(dst.w),
      h: size(dst.h),
    },
  };
}

/** iOS Safari refuses canvases larger than this many pixels. */
export const MAX_PIXELS = 16_777_216;
/** Decode budget on phones reporting ≤ 4 GB: an RGBA copy of this is 32 MB. */
export const LOW_MEMORY_PIXELS = 8_388_608;

/** Pixels a decoded source may hold. `deviceMemory` (GB) is Chromium-only; unknown means the canvas cap. */
export function pixelBudget(deviceMemory?: number): number {
  return deviceMemory !== undefined && deviceMemory <= 4
    ? LOW_MEMORY_PIXELS
    : MAX_PIXELS;
}

/** Same aspect, area ≤ maxPixels. Floors, since rounding up can overshoot the cap. */
export function capSize(
  width: number,
  height: number,
  maxPixels: number,
): { width: number; height: number } {
  const area = width * height;
  if (area <= maxPixels) return { width, height };
  const k = Math.sqrt(maxPixels / area);
  return {
    width: Math.max(1, Math.floor(width * k)),
    height: Math.max(1, Math.floor(height * k)),
  };
}

export function capLayout(l: Layout, maxPixels: number): Layout {
  const area = l.width * l.height;
  return area <= maxPixels
    ? l
    : scaleLayout(l, Math.sqrt(maxPixels / area), Math.floor);
}
