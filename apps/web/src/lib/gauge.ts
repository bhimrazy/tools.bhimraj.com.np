export type GaugeState = "empty" | "pending" | "fits" | "over" | "under";

/** Where the marker sits when the file is past the end of the scale (leaves room for the arrow). */
export const OFF_SCALE_AT = 92;
/** The upper limit lands at two thirds of the rail, so a file just under it still shows a gap. */
const HI_AT = 200 / 3;

export interface GaugeScale {
  lo: number;
  hi: number;
  at?: number;
  offScale: boolean;
}

/** Converts byte limits and a size to rail percentages. */
export function computeGaugeScale({
  lo,
  hi,
  at,
}: {
  lo?: number | undefined;
  hi: number;
  at?: number | undefined;
}): GaugeScale {
  const max = (hi * 100) / HI_AT;
  const pct = (n: number) => Math.round(Math.max(0, (n / max) * 100) * 10) / 10;
  const out: GaugeScale = {
    lo: lo ? pct(lo) : 0,
    hi: pct(hi),
    offScale: false,
  };
  if (at !== undefined) {
    out.offScale = at > max * (OFF_SCALE_AT / 100);
    out.at = out.offScale ? OFF_SCALE_AT : pct(at);
  }
  return out;
}

export function getGaugeState(
  bytes: number,
  maxBytes: number,
  minBytes?: number,
): GaugeState {
  if (bytes > maxBytes) return "over";
  if (minBytes !== undefined && bytes < minBytes) return "under";
  return "fits";
}
