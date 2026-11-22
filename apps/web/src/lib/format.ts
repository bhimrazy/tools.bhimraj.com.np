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

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Countries whose own name is shown in its script; the page must load that script's font. */
const NATIVE: Record<string, { lang: string; script: "deva" | "beng" }> = {
  NP: { lang: "ne", script: "deva" },
  IN: { lang: "hi", script: "deva" },
  BD: { lang: "bn", script: "beng" },
};

export function getNativeCountry(code: string) {
  const n = NATIVE[code];
  if (!n) return null;
  const name = new Intl.DisplayNames([n.lang], { type: "region" }).of(code);
  return name ? { ...n, name } : null;
}

/** The size rule as one line, e.g. "300 × 350 px · 10–200 KB". */
export const formatSizeRule = (rule: SizeRule) =>
  [formatDimensions(rule), formatByteRange(rule)].filter(Boolean).join(" · ");

/** Where the rule came from, in plain words. */
export const formatChecked = (p: Preset) =>
  p.verifiedAt ? `Checked ${formatDate(p.verifiedAt)}` : "Not checked";
