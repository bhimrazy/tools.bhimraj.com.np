import { describe, expect, test } from "bun:test";
import { fitToTarget, MAX_QUALITY, MIN_QUALITY } from "./search";

/** Deterministic stand-in for a real encoder: bytes grow with quality and area. */
function fakeEncoder(side = 1000, onEncode?: () => void) {
  const calls: { quality: number; scale: number }[] = [];
  const encode = async (quality: number, scale: number) => {
    calls.push({ quality, scale });
    onEncode?.();
    const area = (side * scale) ** 2;
    return { bytes: Math.round(area * 0.5 * (0.05 + quality)) };
  };
  return { encode, calls };
}

describe("fitToTarget", () => {
  test("fits on the first try at max quality", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 1_000_000 });
    expect(r).toMatchObject({
      quality: MAX_QUALITY,
      scale: 1,
      withinTarget: true,
      passes: 1,
    });
    expect(calls).toHaveLength(1);
  });

  test("binary-searches quality within 8 passes", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 300_000 });
    expect(calls.length).toBeLessThanOrEqual(8);
    expect(r.passes).toBe(calls.length);
    expect(r.withinTarget).toBe(true);
    expect(r.scale).toBe(1);
    expect(r.result.bytes).toBeLessThanOrEqual(300_000);
    // 300 kB is hit at q = 0.55 exactly
    expect(r.quality).toBeGreaterThan(0.5);
    expect(r.quality).toBeLessThanOrEqual(0.55);
  });

  test("returns the highest fitting quality, not the last probe", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 300_000 });
    const fitting = calls.filter(
      (c) => 500_000 * (0.05 + c.quality) <= 300_000,
    );
    expect(r.quality).toBe(Math.max(...fitting.map((c) => c.quality)));
  });

  test("shrinks dimensions when the floor quality is too large", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 20_000 });
    expect(r.withinTarget).toBe(true);
    expect(r.scale).toBeLessThan(1);
    expect(r.result.bytes).toBeLessThanOrEqual(20_000);
    const firstAtScale = calls.find((c) => c.scale < 1);
    expect(firstAtScale?.quality).toBe(MIN_QUALITY);
  });

  test("impossible target returns the smallest output with withinTarget=false", async () => {
    const { encode } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 10, minScale: 0.2 });
    expect(r.withinTarget).toBe(false);
    expect(r.scale).toBe(0.2);
    expect(r.quality).toBe(MIN_QUALITY);
    expect(r.result.bytes).toBe(Math.round(200 * 200 * 0.5 * 0.1));
  });

  test("maxScaleSteps 0 keeps dimensions fixed", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 20_000, maxScaleSteps: 0 });
    expect(r).toMatchObject({
      withinTarget: false,
      scale: 1,
      quality: MIN_QUALITY,
    });
    expect(calls.every((c) => c.scale === 1)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  test("bounds the number of downscale steps", async () => {
    const { encode, calls } = fakeEncoder();
    await fitToTarget(encode, { maxBytes: 1, minScale: 0, maxScaleSteps: 3 });
    expect(new Set(calls.map((c) => c.scale)).size).toBe(4);
  });

  test("lands between minBytes and maxBytes when possible", async () => {
    const { encode } = fakeEncoder();
    const r = await fitToTarget(encode, {
      maxBytes: 300_000,
      minBytes: 250_000,
    });
    expect(r.withinTarget).toBe(true);
    expect(r.result.bytes).toBeGreaterThanOrEqual(250_000);
    expect(r.result.bytes).toBeLessThanOrEqual(300_000);
  });

  test("too-small output reports withinTarget=false without padding", async () => {
    const { encode } = fakeEncoder(100);
    const r = await fitToTarget(encode, { maxBytes: 20_000, minBytes: 8_000 });
    expect(r).toMatchObject({
      withinTarget: false,
      quality: MAX_QUALITY,
      scale: 1,
    });
    expect(r.result.bytes).toBe(5_000);
  });

  test("rejects invalid targets", async () => {
    const { encode } = fakeEncoder();
    expect(fitToTarget(encode, { maxBytes: 0 })).rejects.toThrow(RangeError);
    expect(fitToTarget(encode, { maxBytes: 10, minBytes: 20 })).rejects.toThrow(
      RangeError,
    );
  });

  test("abort stops between passes", async () => {
    const ctrl = new AbortController();
    let n = 0;
    const { encode, calls } = fakeEncoder(1000, () => {
      if (++n === 2) ctrl.abort();
    });
    const run = fitToTarget(encode, { maxBytes: 300_000, signal: ctrl.signal });
    expect(run).rejects.toMatchObject({ name: "AbortError" });
    await run.catch(() => {});
    expect(calls).toHaveLength(2);
  });

  test("an already-aborted signal encodes nothing", async () => {
    const { encode, calls } = fakeEncoder();
    const run = fitToTarget(encode, {
      maxBytes: 300_000,
      signal: AbortSignal.abort(),
    });
    expect(run).rejects.toMatchObject({ name: "AbortError" });
    await run.catch(() => {});
    expect(calls).toHaveLength(0);
  });
});
