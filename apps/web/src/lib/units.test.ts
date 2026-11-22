import { describe, expect, test } from "bun:test";
import { figureKb, formatKb, statedMaxKb, statedMinKb } from "./units";

describe("figureKb", () => {
  test("rounds a pass down so it never reads as the limit", () => {
    expect(figureKb(49_990, true)).toBe("49.9");
    expect(figureKb(47_250, true)).toBe("47.2");
  });

  test("rounds a fail up so it never reads as under the limit", () => {
    expect(figureKb(50_010, false)).toBe("50.1");
    expect(figureKb(60_001, false)).toBe("60.1");
  });

  test("uses whole KB from 100 KB", () => {
    expect(figureKb(199_600, true)).toBe("199");
    expect(figureKb(200_400, false)).toBe("201");
  });
});

test("stated limits read back as the portal's numbers", () => {
  expect(statedMaxKb(200_000)).toBe("200");
  expect(statedMinKb(10 * 1024)).toBe("10");
  expect(formatKb(3_100_000)).toBe("3.1 MB");
});
