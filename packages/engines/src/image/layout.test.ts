import { expect, test } from "bun:test";
import { computeLayout, scaleLayout } from "./layout";

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
