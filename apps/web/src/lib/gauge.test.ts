import { describe, expect, test } from "bun:test";
import { computeGaugeScale, getGaugeState, OFF_SCALE_AT } from "./gauge";

describe("computeGaugeScale", () => {
  test("puts the upper limit at two thirds of the rail", () => {
    expect(computeGaugeScale({ hi: 50_000 }).hi).toBe(66.7);
  });

  test("places the lower limit and the file on the same scale", () => {
    const g = computeGaugeScale({ lo: 10_240, hi: 200_000, at: 100_000 });
    expect(g.lo).toBe(3.4);
    expect(g.at).toBe(33.3);
    expect(g.offScale).toBe(false);
  });

  test("pins a file past the end of the scale and flags it", () => {
    const g = computeGaugeScale({ hi: 20_000, at: 61_000 });
    expect(g.at).toBe(OFF_SCALE_AT);
    expect(g.offScale).toBe(true);
  });

  test("has no marker before a file exists", () => {
    expect(computeGaugeScale({ hi: 50_000 }).at).toBeUndefined();
  });
});

describe("getGaugeState", () => {
  test("fits inside the window, over above it, under below it", () => {
    expect(getGaugeState(49_999, 50_000)).toBe("fits");
    expect(getGaugeState(50_001, 50_000)).toBe("over");
    expect(getGaugeState(4_000, 50_000, 5_120)).toBe("under");
  });
});
