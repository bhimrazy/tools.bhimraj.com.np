import { expect, test } from "bun:test";
import {
  capLayout,
  capSize,
  computeLayout,
  LOW_MEMORY_PIXELS,
  MAX_PIXELS,
  pixelBudget,
  scaleLayout,
} from "./layout";

test("no size keeps the source", () => {
  expect(computeLayout(400, 300, {})).toEqual({
    width: 400,
    height: 300,
    src: { x: 0, y: 0, w: 400, h: 300 },
    dst: { x: 0, y: 0, w: 400, h: 300 },
  });
});

test("one side keeps aspect", () => {
  expect(computeLayout(400, 300, { width: 200 })).toMatchObject({
    width: 200,
    height: 150,
  });
  expect(computeLayout(400, 300, { height: 150 })).toMatchObject({
    width: 200,
    height: 150,
  });
});

test("cover centre-crops to the exact size", () => {
  expect(computeLayout(400, 300, { width: 100, height: 100 })).toEqual({
    width: 100,
    height: 100,
    src: { x: 50, y: 0, w: 300, h: 300 },
    dst: { x: 0, y: 0, w: 100, h: 100 },
  });
});

test("contain letterboxes inside the exact size", () => {
  expect(
    computeLayout(400, 300, { width: 100, height: 100, fit: "contain" }),
  ).toEqual({
    width: 100,
    height: 100,
    src: { x: 0, y: 0, w: 400, h: 300 },
    dst: { x: 0, y: 12, w: 100, h: 75 },
  });
});

test("scaleLayout scales output and destination, never below 1px", () => {
  const l = computeLayout(400, 300, {
    width: 100,
    height: 100,
    fit: "contain",
  });
  expect(scaleLayout(l, 0.5)).toMatchObject({
    width: 50,
    height: 50,
    dst: { x: 0, y: 6, w: 50, h: 38 },
  });
  expect(scaleLayout(l, 0.001)).toMatchObject({ width: 1, height: 1 });
});

test("capLayout floors so rounding never exceeds the pixel cap", () => {
  // Rounding gave 4730 × 3547 = 16,777,310 px here.
  const l = capLayout(computeLayout(4000, 3000, { width: 5000 }), MAX_PIXELS);
  expect(l.width * l.height).toBeLessThanOrEqual(MAX_PIXELS);
  expect(l).toMatchObject({ width: 4729, height: 3547 });
  for (const [w, h] of [
    [8191, 4097],
    [12000, 9000],
    [16383, 1025],
  ] as const) {
    const c = capLayout(computeLayout(w, h, {}), MAX_PIXELS);
    expect(c.width * c.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(c.dst.w * c.dst.h).toBeLessThanOrEqual(MAX_PIXELS);
  }
});

test("capSize keeps small sizes and floors large ones", () => {
  expect(capSize(400, 300, MAX_PIXELS)).toEqual({ width: 400, height: 300 });
  const big = capSize(8660, 5773, MAX_PIXELS); // 50 MP
  expect(big.width * big.height).toBeLessThanOrEqual(MAX_PIXELS);
  expect(big.width / big.height).toBeCloseTo(8660 / 5773, 2);
});

test("pixelBudget halves the cap on phones reporting ≤ 4 GB", () => {
  expect(pixelBudget(undefined)).toBe(MAX_PIXELS);
  expect(pixelBudget(8)).toBe(MAX_PIXELS);
  expect(pixelBudget(4)).toBe(LOW_MEMORY_PIXELS);
  expect(pixelBudget(2)).toBe(LOW_MEMORY_PIXELS);
});
