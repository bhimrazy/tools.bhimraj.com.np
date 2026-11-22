// Matches @tools/presets kbMax/kbMin: portals' "KB" is ambiguous, so caps are KB x 1000 and
// floors KB x 1024 (safe either way). Displaying with the same factors shows the portal's number.
export const KB_MAX = 1000;
export const KB_MIN = 1024;

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const statedMaxKb = (bytes: number) => trim(bytes / KB_MAX);
export const statedMinKb = (bytes: number) => trim(bytes / KB_MIN);

/** Result sizes use the cap's factor so "≤ 200 KB" and "198.4 KB" compare directly. */
export function formatKb(bytes: number): string {
  const kb = bytes / KB_MAX;
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} MB`;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export const formatBytes = (bytes: number) =>
  `${bytes.toLocaleString("en-US")} bytes`;

/**
 * The result figure in KB without its unit. Rounds down on a pass and up on a fail, so a
 * passing file never reads as the limit itself (49,990 bytes shows 49.9, not 50.0).
 */
export function figureKb(bytes: number, pass: boolean): string {
  const kb = bytes / KB_MAX;
  const step = kb >= 100 ? 1 : 10;
  const n = (pass ? Math.floor : Math.ceil)(kb * step) / step;
  return step === 1 ? String(n) : n.toFixed(1);
}
