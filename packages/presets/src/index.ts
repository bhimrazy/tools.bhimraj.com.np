import { bd } from "./data/bd";
import { np } from "./data/np";
import { us } from "./data/us";

// Plain data only: no zod, so islands can import this. Validation lives in "@tools/presets/schema" (tests).
export { kbMax, kbMin, MAX_HEADROOM, MIN_MARGIN } from "./bytes";

/** Formats the image engine can encode. */
export type ImageFormat = "image/jpeg" | "image/webp";

export interface Preset {
  /** kebab-case, unique */
  id: string;
  /** site path without leading slash, unique, e.g. "np/lok-sewa-photo" */
  path: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  portal: string;
  title: string;
  kind: "photo" | "signature" | "scan";
  output: {
    format: ImageFormat;
    width?: number;
    height?: number;
    /** "cover" crops from the centre; "contain" letterboxes on `background` so nothing is cut off */
    fit: "cover" | "contain";
    minBytes?: number;
    maxBytes: number;
    /** CSS hex colour to flatten transparency onto */
    background?: string;
  };
  source: { url: string; label: string } | null;
  /** YYYY-MM-DD the spec was last checked against `source`; null = unverified */
  verifiedAt: string | null;
  notes?: string;
}

export const presets: readonly Preset[] = [...np, ...bd, ...us];

export function presetsByCountry(): Map<string, Preset[]> {
  const map = new Map<string, Preset[]>();
  for (const p of presets)
    map.set(p.country, [...(map.get(p.country) ?? []), p]);
  return map;
}

export function getPreset(id: string): Preset | undefined {
  return presets.find((p) => p.id === id);
}

/** Structurally matches `CompressOptions` in @tools/engines/image (not imported to keep this package dependency-free). */
export interface PresetCompressOptions {
  maxBytes: number;
  minBytes?: number;
  width?: number;
  height?: number;
  fit: "cover" | "contain";
  format: ImageFormat;
  background?: string;
}

export function presetToCompressOptions(p: Preset): PresetCompressOptions {
  const { maxBytes, minBytes, width, height, fit, format, background } =
    p.output;
  return {
    maxBytes,
    fit,
    format,
    ...(minBytes !== undefined && { minBytes }),
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(background !== undefined && { background }),
  };
}
