import { MAX_HEADROOM, MIN_MARGIN } from "@tools/presets";

// Matches @tools/presets kbMax/kbMin: caps are KB x 1000 and floors KB x 1024, each with ~1% headroom.
// Displaying undoes the headroom to show the portal's number.
export const KB_MAX = 1000;
export const KB_MIN = 1024;

const trim = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export const statedMaxKb = (bytes: number) =>
  trim(bytes / (KB_MAX * MAX_HEADROOM));
export const statedMinKb = (bytes: number) =>
  trim(bytes / (KB_MIN * MIN_MARGIN));

/** Result sizes use the cap's factor so "≤ 200 KB" and "198.4 KB" compare directly. */
export function formatKb(bytes: number): string {
  const kb = bytes / KB_MAX;
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} MB`;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export const formatBytes = (bytes: number) =>
  `${bytes.toLocaleString("en-US")} bytes`;
