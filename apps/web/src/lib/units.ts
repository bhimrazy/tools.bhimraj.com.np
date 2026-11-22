import { KB } from "@tools/presets";

/** Result sizes use the cap's factor so "≤ 200 KB" and "198.4 KB" compare directly. */
export function formatFileSize(bytes: number): string {
  const kb = bytes / KB;
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} MB`;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export const formatBytes = (bytes: number) =>
  `${bytes.toLocaleString("en-US")} bytes`;

/**
 * The result figure in KB without its unit. Rounds down on a pass and up on a fail, so a
 * passing file never reads as the limit itself (49,990 bytes shows 49.9, not 50.0).
 */
export function formatFigureKb(bytes: number, pass: boolean): string {
  const kb = bytes / KB;
  const step = kb >= 100 ? 1 : 10;
  const n = (pass ? Math.floor : Math.ceil)(kb * step) / step;
  return step === 1 ? String(n) : n.toFixed(1);
}
