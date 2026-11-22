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

/** Countries whose own name is shown in its script; needs the matching font on the page. */
const NATIVE: Record<string, { lang: string; script: "deva" | "beng" }> = {
  NP: { lang: "ne", script: "deva" },
  IN: { lang: "hi", script: "deva" },
  BD: { lang: "bn", script: "beng" },
};

export function nativeCountry(code: string) {
  const n = NATIVE[code];
  if (!n) return null;
  const name = new Intl.DisplayNames([n.lang], { type: "region" }).of(code);
  return name ? { ...n, name } : null;
}

/** The size rule as one line, e.g. "300 × 350 px · 10–200 KB". */
export const ruleLine = (p: Preset) =>
  [dimensions(p), sizeRange(p)].filter(Boolean).join(" · ");

/** Where the rule came from, in plain words. */
export const ruleChecked = (p: Preset) =>
  p.verifiedAt ? `Checked ${formatDate(p.verifiedAt)}` : "Not checked";
