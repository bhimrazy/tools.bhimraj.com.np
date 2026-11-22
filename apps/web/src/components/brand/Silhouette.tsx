/** A form's upload shape at true proportion inside a 40-unit box. */
export function Silhouette({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const s = 34 / Math.max(width, height);
  const w = width * s;
  const h = height * s;
  return (
    <svg
      className="sil size-10 shrink-0"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="f"
        x={(40 - w) / 2}
        y={(40 - h) / 2}
        width={w}
        height={h}
        rx=".75"
      />
    </svg>
  );
}

/** The upload's shape at true proportion, large, with its pixel size along two edges. */
export function SilhouetteFrame({
  width,
  height,
  className = "",
}: {
  width: number;
  height: number;
  className?: string;
}) {
  const s = Math.min(170 / width, 118 / height);
  const w = width * s;
  const h = height * s;
  const x = (232 - w) / 2;
  const y = 24 + (118 - h) / 2;
  return (
    <svg
      className={`sil sil-frame ${className}`}
      viewBox="0 0 256 156"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="f" x={x} y={y} width={w} height={h} rx="1.5" />
      <text x={x + w / 2} y={y - 8} textAnchor="middle">
        {width} px
      </text>
      <text x={x + w + 7} y={y + h / 2 + 4}>
        {height} px
      </text>
    </svg>
  );
}
