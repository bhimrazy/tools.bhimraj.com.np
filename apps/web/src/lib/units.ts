import { KB } from "@tools/presets";

/** Result sizes use the cap's factor so "≤ 200 KB" and "198.4 KB" compare directly. */
export function formatFileSize(bytes: number): string {
  const kb = bytes / KB;
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} MB`;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export const formatBytes = (bytes: number) =>
  `${bytes.toLocaleString("en-US")} bytes`;
