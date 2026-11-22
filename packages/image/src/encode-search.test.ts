import { describe, expect, test } from "bun:test";
import { fitToTarget, FREE_QUALITY, MAX_QUALITY, MIN_QUALITY } from "./search";

interface Call {
  quality: number;
  scale: number;
  bytes: number;
}

/**
 * Stand-in encoder: bytes grow with quality and area. `detail` makes smaller images cost more
 * per pixel, as real photos do; `jitter` makes size non-monotonic in quality.
 */
function fakeEncoder({
  pixels = 1_000_000,
  detail = 0,
  jitter = (_q: number): number => 0,
  onEncode = () => {},
} = {}) {
  const calls: Call[] = [];
  const encode = async (quality: number, scale: number) => {
    onEncode();
    const bpp = 0.5 * (0.05 + quality) * (1 + detail * (1 - scale));
    const bytes = Math.round(pixels * scale ** 2 * bpp + jitter(quality));
    calls.push({ quality, scale, bytes });
    return { bytes };
  };
  return { encode, calls };
}

const perScale = (calls: Call[]) => {
  const n = new Map<number, number>();
  for (const c of calls) n.set(c.scale, (n.get(c.scale) ?? 0) + 1);
  return n;
};

describe("fixed-size jobs search quality only", () => {
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

  test("binary-searches quality within 8 passes and returns the best fit", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 300_000 });
    expect(calls.length).toBeLessThanOrEqual(8);
    expect(r.passes).toBe(calls.length);
    expect(r).toMatchObject({ withinTarget: true, scale: 1 });
    // 300 kB is hit at q = 0.55 exactly
    expect(r.quality).toBeGreaterThan(0.5);
    expect(r.quality).toBeLessThanOrEqual(0.55);
    const fitting = calls.filter((c) => c.bytes <= 300_000);
    expect(r.quality).toBe(Math.max(...fitting.map((c) => c.quality)));
  });

  test("never shrinks; reports the floor when it doesn't fit", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, { maxBytes: 20_000 });
    expect(r).toMatchObject({
      withinTarget: false,
      scale: 1,
      quality: MIN_QUALITY,
    });
    expect(calls.map((c) => c.quality)).toEqual([MAX_QUALITY, MIN_QUALITY]);
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

  test("too-small output reports withinTarget=false (the caller pads)", async () => {
    const { encode } = fakeEncoder({ pixels: 10_000 });
    const r = await fitToTarget(encode, { maxBytes: 20_000, minBytes: 8_000 });
    expect(r).toMatchObject({
      withinTarget: false,
      quality: MAX_QUALITY,
      scale: 1,
    });
    expect(r.result.bytes).toBe(5_000);
  });

  test("a non-monotonic encoder never yields an over-limit result", async () => {
    // Every third whole percent costs 40 kB extra, so bisection sees fits above misses.
    const { encode, calls } = fakeEncoder({
      jitter: (q) => (Math.round(q * 100) % 3 === 0 ? 40_000 : 0),
    });
    const r = await fitToTarget(encode, { maxBytes: 300_000 });
    expect(r.withinTarget).toBe(true);
    expect(r.result.bytes).toBeLessThanOrEqual(300_000);
    expect(calls.length).toBeLessThanOrEqual(8);
    const fitting = calls.filter((c) => c.bytes <= 300_000);
    expect(r.quality).toBe(Math.max(...fitting.map((c) => c.quality)));
  });
});

describe("free-size jobs choose scale first", () => {
  test("keeps full size when the start quality fits", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, {
      maxBytes: 1_000_000,
      policy: "free",
    });
    expect(r.scale).toBe(1);
    expect(r.quality).toBeGreaterThanOrEqual(FREE_QUALITY.start);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  test("12 MP at 100 kB: shrinks instead of dropping quality, in few full-size encodes", async () => {
    for (const detail of [0, 1]) {
      const { encode, calls } = fakeEncoder({ pixels: 12_000_000, detail });
      const r = await fitToTarget(encode, {
        maxBytes: 100_000,
        policy: "free",
        minScale: 0.02,
      });
      expect(r.withinTarget).toBe(true);
      expect(r.result.bytes).toBeLessThanOrEqual(100_000);
      expect(r.quality).toBeGreaterThanOrEqual(FREE_QUALITY.min);
      expect(r.quality).toBeLessThanOrEqual(FREE_QUALITY.max);
      expect(calls.filter((c) => c.scale === 1).length).toBeLessThanOrEqual(3);
      expect(calls.length).toBeLessThanOrEqual(12);
    }
  });

  test("bounds encodes per scale", async () => {
    const { encode, calls } = fakeEncoder({ pixels: 12_000_000, detail: 3 });
    await fitToTarget(encode, {
      maxBytes: 50_000,
      policy: "free",
      minScale: 0.01,
      maxPasses: 5,
    });
    const counts = perScale(calls);
    expect(counts.get(1)).toBeLessThanOrEqual(3);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(5);
  });

  test("drops below the quality floor only at the smallest scale", async () => {
    const { encode, calls } = fakeEncoder();
    const r = await fitToTarget(encode, {
      maxBytes: 2_000,
      policy: "free",
      minScale: 0.1,
    });
    expect(r.scale).toBe(0.1);
    expect(r.withinTarget).toBe(true);
    expect(r.quality).toBeLessThan(FREE_QUALITY.min);
    const belowFloor = calls.filter((c) => c.quality < FREE_QUALITY.min);
    expect(belowFloor.every((c) => c.scale === 0.1)).toBe(true);
  });

  test("impossible target returns the smallest output with withinTarget=false", async () => {
    const { encode } = fakeEncoder();
    const r = await fitToTarget(encode, {
      maxBytes: 10,
      minScale: 0.2,
      policy: "free",
    });
    expect(r).toMatchObject({
      withinTarget: false,
      scale: 0.2,
      quality: MIN_QUALITY,
    });
    expect(r.result.bytes).toBe(Math.round(200 * 200 * 0.5 * 0.1));
  });

  test("bounds the number of downscale steps", async () => {
    // A fixed header cost means no scale ever fits.
    const { encode, calls } = fakeEncoder({ jitter: () => 1_000 });
    await fitToTarget(encode, {
      maxBytes: 1,
      minScale: 0,
      maxScaleSteps: 3,
      policy: "free",
    });
    expect(perScale(calls).size).toBe(4);
  });
});

describe("validation and abort", () => {
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
    const { encode, calls } = fakeEncoder({
      onEncode: () => {
        if (++n === 2) ctrl.abort();
      },
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
