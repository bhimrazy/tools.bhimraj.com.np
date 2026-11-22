import {
  maxBytesToKb,
  minBytesToKb,
  type OutputFormat,
  type Preset,
  type SizeRule,
} from "@tools/presets";

const regions = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string) => regions.of(code) ?? code;

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  "image/jpeg": "JPEG (.jpg)",
  "image/webp": "WebP",
};

export function formatByteRange({ minBytes, maxBytes }: SizeRule): string {
  return minBytes === undefined
    ? `up to ${maxBytesToKb(maxBytes)} KB`
    : `${minBytesToKb(minBytes)}–${maxBytesToKb(maxBytes)} KB`;
}

export function formatDimensions({ width, height }: SizeRule): string | null {
  if (width && height) return `${width} × ${height} px`;
  if (width) return `${width} px wide`;
  if (height) return `${height} px tall`;
  return null;
}

/** Country groups sorted by display name. */
export const sortByCountryName = (groups: Map<string, Preset[]>) =>
  [...groups].sort(([a], [b]) => countryName(a).localeCompare(countryName(b)));

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
