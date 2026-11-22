import { describe, expect, test } from "bun:test";
import { gaugeScale, gaugeState, OFF_SCALE_AT } from "./gauge";

describe("gaugeScale", () => {
  test("puts the upper limit at two thirds of the rail", () => {
    expect(gaugeScale({ hi: 50_000 }).hi).toBe(66.7);
  });

  test("places the lower limit and the file on the same scale", () => {
    const g = gaugeScale({ lo: 10_240, hi: 200_000, at: 100_000 });
    expect(g.lo).toBe(3.4);
    expect(g.at).toBe(33.3);
    expect(g.offScale).toBe(false);
  });

  test("pins a file past the end of the scale and flags it", () => {
    const g = gaugeScale({ hi: 20_000, at: 61_000 });
    expect(g.at).toBe(OFF_SCALE_AT);
    expect(g.offScale).toBe(true);
  });

  test("has no marker before a file exists", () => {
    expect(gaugeScale({ hi: 50_000 }).at).toBeUndefined();
  });
});

describe("gaugeState", () => {
  test("fits inside the window, over above it, under below it", () => {
    expect(gaugeState(49_999, 50_000)).toBe("fit");
    expect(gaugeState(50_001, 50_000)).toBe("over");
    expect(gaugeState(4_000, 50_000, 5_120)).toBe("under");
  });
});
