import { expect, test } from "bun:test";
import { getPreset, presetSchema, presets, presetsByCountry } from "./index";

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
