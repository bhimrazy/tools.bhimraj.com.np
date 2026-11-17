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

export function scaleLayout(l: Layout, scale: number): Layout {
  if (scale === 1) return l;
  const { dst } = l;
  return {
    width: px(l.width * scale),
    height: px(l.height * scale),
    src: l.src,
    dst: {
      x: Math.round(dst.x * scale),
      y: Math.round(dst.y * scale),
      w: px(dst.w * scale),
      h: px(dst.h * scale),
    },
  };
}
