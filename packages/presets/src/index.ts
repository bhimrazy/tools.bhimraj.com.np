import { bd } from "./data/bd";
import { np } from "./data/np";
import { us } from "./data/us";
import { validatePresets } from "./schema";

export { kbMax, kbMin, presetSchema, validatePresets } from "./schema";

export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

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

export const presets: readonly Preset[] = validatePresets([
  ...np,
  ...bd,
  ...us,
]);

export function presetsByCountry(): Map<string, Preset[]> {
  const map = new Map<string, Preset[]>();
  for (const p of presets)
    map.set(p.country, [...(map.get(p.country) ?? []), p]);
  return map;
}

export function getPreset(id: string): Preset | undefined {
  return presets.find((p) => p.id === id);
}
