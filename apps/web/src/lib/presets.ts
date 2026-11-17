import type { ImageFormat, Preset } from "@tools/presets";
import { statedMaxKb, statedMinKb } from "./units";

const regions = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string) => regions.of(code) ?? code;

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  "image/jpeg": "JPEG (.jpg)",
  "image/png": "PNG",
  "image/webp": "WebP",
};

export function sizeRange(p: Preset): string {
  const { minBytes, maxBytes } = p.output;
  return minBytes === undefined
    ? `up to ${statedMaxKb(maxBytes)} KB`
    : `${statedMinKb(minBytes)}–${statedMaxKb(maxBytes)} KB`;
}

export function dimensions(p: Preset): string | null {
  const { width, height } = p.output;
  if (width && height) return `${width} × ${height} px`;
  if (width) return `${width} px wide`;
  if (height) return `${height} px tall`;
  return null;
}

export function groupByCountry(list: readonly Preset[]): [string, Preset[]][] {
  const map = new Map<string, Preset[]>();
  for (const p of list) map.set(p.country, [...(map.get(p.country) ?? []), p]);
  return [...map].sort(([a], [b]) =>
    countryName(a).localeCompare(countryName(b)),
  );
}

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
