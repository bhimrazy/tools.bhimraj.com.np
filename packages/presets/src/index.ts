import { bd } from "./data/bd";
import { np } from "./data/np";
import { us } from "./data/us";

// Plain data only: no zod, so islands can import this. Validation lives in "@tools/presets/schema" (tests).
export {
  KB,
  KIB,
  kbToMaxBytes,
  kbToMinBytes,
  MAX_BYTES_HEADROOM,
  maxBytesToKb,
  MIN_BYTES_HEADROOM,
  minBytesToKb,
} from "./bytes";

/** Formats `@tools/image` can encode. */
export type OutputFormat = "image/jpeg" | "image/webp";

/** What a form asks the file to be. */
export type UploadKind = "photo" | "signature" | "scan";

/** A form's numbers for one upload. Structurally matches `CompressOptions` in `@tools/image`
 * (not imported, to keep this package dependency-free). */
export interface SizeRule {
  format: OutputFormat;
  width?: number;
  height?: number;
  /** "cover" crops from the centre; "contain" letterboxes on `background` so nothing is cut off */
  fit: "cover" | "contain";
  minBytes?: number;
  maxBytes: number;
  /** CSS hex colour to flatten transparency onto */
  background?: string;
}

export interface Preset {
  /** kebab-case, unique */
  id: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  portal: string;
  /** URL slugs: the page is /forms/{cc}/{org}/{form} and this upload its #{upload} section */
  org: string;
  form: string;
  formTitle: string;
  upload: string;
  title: string;
  kind: UploadKind;
  rule: SizeRule;
  source: { url: string; label: string } | null;
  /** YYYY-MM-DD the size rule was last checked against `source`; null = not checked */
  verifiedAt: string | null;
  notes?: string;
}

export const presets: readonly Preset[] = [...np, ...bd, ...us];

export function groupByCountry(
  list: readonly Preset[] = presets,
): Map<string, Preset[]> {
  const map = new Map<string, Preset[]>();
  for (const p of list) map.set(p.country, [...(map.get(p.country) ?? []), p]);
  return map;
}

/** The form page, e.g. "/forms/np/psc/lok-sewa-application". The only place form URLs are built. */
export const formPath = (p: Preset): string =>
  `/forms/${p.country.toLowerCase()}/${p.org}/${p.form}`;

/** One upload's section on its form page. */
export const uploadPath = (p: Preset): string => `${formPath(p)}#${p.upload}`;

/** Presets by form page path, in registry order. */
export function groupByForm(
  list: readonly Preset[] = presets,
): Map<string, Preset[]> {
  const map = new Map<string, Preset[]>();
  for (const p of list) {
    const path = formPath(p);
    map.set(path, [...(map.get(path) ?? []), p]);
  }
  return map;
}

export function getPreset(id: string): Preset | undefined {
  return presets.find((p) => p.id === id);
}

/** Copies `rule` without unset keys (`exactOptionalPropertyTypes` rejects explicit `undefined`). */
export function toCompressOptions(rule: SizeRule): SizeRule {
  const { maxBytes, minBytes, width, height, fit, format, background } = rule;
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
