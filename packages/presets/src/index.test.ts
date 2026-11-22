import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  kbToMaxBytes,
  kbToMinBytes,
  maxBytesToKb,
  minBytesToKb,
} from "./bytes";
import {
  formPath,
  getPreset,
  groupByCountry,
  groupByForm,
  presets,
  toCompressOptions,
  uploadPath,
} from "./index";
import { presetSchema, validatePresets } from "./schema";

test("presets are non-empty and schema-valid", () => {
  expect(presets.length).toBeGreaterThan(0);
  for (const p of presets) expect(presetSchema.safeParse(p).success).toBe(true);
});

test("ids and upload paths are unique", () => {
  expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
  expect(new Set(presets.map(uploadPath)).size).toBe(presets.length);
});

test("form URLs are built from the slugs", () => {
  const p = getPreset("np-psc-lok-sewa-application-photo");
  if (!p) throw new Error("missing preset");
  expect(formPath(p)).toBe("/forms/np/psc/lok-sewa-application");
  expect(uploadPath(p)).toBe("/forms/np/psc/lok-sewa-application#photo");
  expect(
    groupByForm()
      .get(formPath(p))
      ?.map((x) => x.upload),
  ).toEqual(["photo", "signature"]);
});

test("byte and dimension sanity", () => {
  for (const { rule: o } of presets) {
    if (o.minBytes !== undefined) expect(o.minBytes).toBeLessThan(o.maxBytes);
    for (const d of [o.width, o.height])
      if (d !== undefined) expect(Number.isInteger(d) && d > 0).toBe(true);
  }
});

test("verifiedAt is a real date or null; verified entries have an https source", () => {
  for (const p of presets) {
    if (p.verifiedAt === null) continue;
    expect(
      new Date(`${p.verifiedAt}T00:00:00Z`)
        .toISOString()
        .startsWith(p.verifiedAt),
    ).toBe(true);
    expect(p.source?.url.startsWith("https://")).toBe(true);
  }
  for (const p of presets)
    if (p.source) expect(p.source.url.startsWith("https://")).toBe(true);
});

test("schema rejects bad data", () => {
  const base = structuredClone(presets[0]);
  expect(presetSchema.safeParse({ ...base, org: "other" }).success).toBe(false);
  expect(presetSchema.safeParse({ ...base, upload: "Photo" }).success).toBe(
    false,
  );
  expect(
    presetSchema.safeParse({ ...base, verifiedAt: "2026-02-30" }).success,
  ).toBe(false);
  expect(
    presetSchema.safeParse({
      ...base,
      source: { url: "http://a.example", label: "x" },
    }).success,
  ).toBe(false);
  expect(
    presetSchema.safeParse({
      ...base,
      rule: { ...base?.rule, minBytes: 9e9 },
    }).success,
  ).toBe(false);
});

test("getPreset and groupByCountry", () => {
  expect(getPreset("us-state-dept-dv-lottery-entry-photo")?.country).toBe("US");
  expect(getPreset("nope")).toBeUndefined();
  expect(groupByCountry().get("NP")?.length).toBe(2);
  // The owner's order, not alphabetical.
  expect([...groupByCountry().keys()]).toEqual(["NP", "US", "BD"]);
});

test("data passes the zod schema", () => {
  expect(validatePresets(presets)).toHaveLength(presets.length);
});

test("uploads on one form page agree on its title", () => {
  const [a, b] = presets;
  if (!a || !b) throw new Error("need two presets");
  const extra = { ...a, id: `${a.id}-x`, upload: `${a.upload}-x` };
  expect(() => validatePresets([a, extra])).not.toThrow();
  expect(() => validatePresets([a, { ...extra, formTitle: "Other" }])).toThrow(
    /mixed formTitle/,
  );
  expect(() => validatePresets([b, b])).toThrow(/duplicate/);
});

test("signatures contain, photos cover", () => {
  for (const p of presets)
    expect(p.rule.fit).toBe(p.kind === "photo" ? "cover" : "contain");
  const sig = structuredClone(presets.find((p) => p.kind === "signature"));
  if (sig) sig.rule.fit = "cover";
  expect(presetSchema.safeParse(sig).success).toBe(false);
});

test("schema rejects png output", () => {
  const base = structuredClone(presets[0]);
  expect(
    presetSchema.safeParse({
      ...base,
      rule: { ...base?.rule, format: "image/png" },
    }).success,
  ).toBe(false);
});

test("byte limits keep headroom", () => {
  expect(kbToMaxBytes(200)).toBe(198_000);
  expect(kbToMaxBytes(200)).toBeLessThan(200_000);
  expect(kbToMinBytes(10)).toBeGreaterThan(10 * 1024);
  expect(kbToMinBytes(10)).toBe(10_343);
});

test("bytes convert back to the stated KB", () => {
  expect(maxBytesToKb(kbToMaxBytes(200))).toBe(200);
  expect(minBytesToKb(kbToMinBytes(10))).toBe(10);
  expect(maxBytesToKb(kbToMaxBytes(12.5))).toBe(12.5);
});

test("toCompressOptions copies the rule and omits unset keys", () => {
  const p = getPreset("np-psc-lok-sewa-application-signature");
  if (!p) throw new Error("missing preset");
  expect(toCompressOptions(p.rule)).toEqual({
    maxBytes: kbToMaxBytes(100),
    minBytes: kbToMinBytes(5),
    width: 300,
    height: 80,
    fit: "contain",
    format: "image/jpeg",
    background: "#ffffff",
  });
  const bare = toCompressOptions({
    format: "image/webp",
    fit: "cover",
    maxBytes: 5,
  });
  expect(bare).toEqual({ maxBytes: 5, fit: "cover", format: "image/webp" });
});

test("plain entry never reaches zod", () => {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    expect(src).not.toMatch(/from ["']zod/);
    for (const m of src.matchAll(/from ["'](\.[^"']*)["']/g)) {
      const target = resolve(dirname(file), m[1] ?? "");
      expect(target.endsWith("/schema")).toBe(false);
      for (const ext of [".ts", "/index.ts"])
        try {
          walk(target + ext);
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
    }
  };
  walk(resolve(import.meta.dir, "index.ts"));
  expect(seen.size).toBeGreaterThan(4);
});
