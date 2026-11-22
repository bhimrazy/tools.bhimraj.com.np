import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  kbToMaxBytes,
  kbToMinBytes,
  maxBytesToKb,
  minBytesToKb,
} from "./bytes";
import { getPreset, groupByCountry, toCompressOptions, presets } from "./index";
import { presetSchema, validatePresets } from "./schema";

test("presets are non-empty and schema-valid", () => {
  expect(presets.length).toBeGreaterThan(0);
  for (const p of presets) expect(presetSchema.safeParse(p).success).toBe(true);
});

test("ids and paths are unique", () => {
  expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
  expect(new Set(presets.map((p) => p.path)).size).toBe(presets.length);
});

test("path format and country prefix", () => {
  for (const p of presets) {
    expect(p.path).toMatch(/^[a-z]{2}\/[a-z0-9-]+$/);
    expect(p.path.slice(0, 2)).toBe(p.country.toLowerCase());
  }
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
  expect(presetSchema.safeParse({ ...base, path: "xx/foo" }).success).toBe(
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
  expect(getPreset("us-dv-lottery-photo")?.country).toBe("US");
  expect(getPreset("nope")).toBeUndefined();
  expect(groupByCountry().get("NP")?.length).toBe(2);
});

test("data passes the zod schema", () => {
  expect(validatePresets(presets)).toHaveLength(presets.length);
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
  const p = getPreset("np-lok-sewa-signature");
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
