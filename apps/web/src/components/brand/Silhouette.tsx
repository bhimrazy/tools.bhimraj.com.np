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
