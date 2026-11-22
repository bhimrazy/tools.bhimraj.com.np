import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { kbMax, kbMin } from "./bytes";
import {
  getPreset,
  presetsByCountry,
  presetToCompressOptions,
  presets,
} from "./index";
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
  for (const { output: o } of presets) {
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
      output: { ...base?.output, minBytes: 9e9 },
    }).success,
  ).toBe(false);
});

test("getPreset and presetsByCountry", () => {
  expect(getPreset("us-dv-lottery-photo")?.country).toBe("US");
  expect(getPreset("nope")).toBeUndefined();
  expect(presetsByCountry().get("NP")?.length).toBe(2);
});

test("data passes the zod schema", () => {
  expect(validatePresets(presets)).toHaveLength(presets.length);
});

test("signatures contain, photos cover", () => {
  for (const p of presets)
    expect(p.output.fit).toBe(p.kind === "photo" ? "cover" : "contain");
  const sig = structuredClone(presets.find((p) => p.kind === "signature"));
  if (sig) sig.output.fit = "cover";
  expect(presetSchema.safeParse(sig).success).toBe(false);
});

test("schema rejects png output", () => {
  const base = structuredClone(presets[0]);
  expect(
    presetSchema.safeParse({
      ...base,
      output: { ...base?.output, format: "image/png" },
    }).success,
  ).toBe(false);
});

test("byte limits keep headroom", () => {
  expect(kbMax(200)).toBe(198_000);
  expect(kbMax(200)).toBeLessThan(200_000);
  expect(kbMin(10)).toBeGreaterThan(10 * 1024);
  expect(kbMin(10)).toBe(10_343);
});

test("presetToCompressOptions maps output and omits unset keys", () => {
  const p = getPreset("np-lok-sewa-signature");
  if (!p) throw new Error("missing preset");
  expect(presetToCompressOptions(p)).toEqual({
    maxBytes: kbMax(100),
    minBytes: kbMin(5),
    width: 300,
    height: 80,
    fit: "contain",
    format: "image/jpeg",
    background: "#ffffff",
  });
  const bare = presetToCompressOptions({
    ...p,
    output: { format: "image/webp", fit: "cover", maxBytes: 5 },
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
