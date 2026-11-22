import { z } from "zod";
import type { Preset } from "./index";

// Byte limits carry ~1% headroom via kbToMaxBytes/kbToMinBytes (see bytes.ts); zod-validated data, tests and build only.

const dim = z.number().int().positive();
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "invalid calendar date");

export const presetSchema = z
  .object({
    id: slug,
    country: z.string().regex(/^[A-Z]{2}$/),
    portal: z.string().min(1),
    org: slug,
    form: slug,
    formTitle: z.string().min(1),
    upload: slug,
    title: z.string().min(1),
    kind: z.enum(["photo", "signature", "scan"]),
    rule: z.strictObject({
      format: z.enum(["image/jpeg", "image/webp"]),
      width: dim.optional(),
      height: dim.optional(),
      fit: z.enum(["cover", "contain"]),
      minBytes: dim.optional(),
      maxBytes: dim,
      background: z
        .string()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
        .optional(),
    }),
    source: z
      .strictObject({
        url: z.url({ protocol: /^https$/ }),
        label: z.string().min(1),
      })
      .nullable(),
    verifiedAt: isoDate.nullable(),
    notes: z.string().optional(),
  })
  .strict()
  .refine(
    (p) => p.id === `${p.country.toLowerCase()}-${p.org}-${p.form}-${p.upload}`,
    "id must be {cc}-{org}-{form}-{upload}",
  )
  .refine(
    (p) => p.rule.minBytes === undefined || p.rule.minBytes < p.rule.maxBytes,
    "minBytes must be < maxBytes",
  )
  .refine(
    (p) => p.kind === "photo" || p.rule.fit === "contain",
    "signatures and scans must use fit contain",
  )
  .refine(
    (p) => p.verifiedAt === null || p.source !== null,
    "verifiedAt requires a source",
  );

// Compile-time drift check: every Preset must satisfy the schema's output type
// (zod's optional adds `| undefined`, which exactOptionalPropertyTypes rejects the other way).
export const _presetMatchesSchema = (
  p: Preset,
): z.output<typeof presetSchema> => p;

export function validatePresets(list: readonly unknown[]): Preset[] {
  const out = list.map((p) => presetSchema.parse(p) as Preset);
  const seen = new Set<string>();
  const forms = new Map<string, Preset>();
  for (const p of out) {
    if (seen.has(p.id)) throw new Error(`duplicate preset id: ${p.id}`);
    seen.add(p.id);
    // One page per form, so its uploads must agree on what the page shows.
    const key = `${p.country}/${p.org}/${p.form}`;
    const first = forms.get(key);
    if (!first) forms.set(key, p);
    else if (first.formTitle !== p.formTitle || first.portal !== p.portal)
      throw new Error(`form ${key} has mixed formTitle or portal`);
  }
  return out;
}
