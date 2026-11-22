import { describe, expect, test } from "bun:test";
import { formatFigureKb, formatFileSize } from "./units";

describe("formatFigureKb", () => {
  test("rounds a pass down so it never reads as the limit", () => {
    expect(formatFigureKb(49_990, true)).toBe("49.9");
    expect(formatFigureKb(47_250, true)).toBe("47.2");
  });

  test("rounds a fail up so it never reads as under the limit", () => {
    expect(formatFigureKb(50_010, false)).toBe("50.1");
    expect(formatFigureKb(60_001, false)).toBe("60.1");
  });

  test("uses whole KB from 100 KB", () => {
    expect(formatFigureKb(199_600, true)).toBe("199");
    expect(formatFigureKb(200_400, false)).toBe("201");
  });
});

test("formatFileSize switches to MB from 1,000 KB", () => {
  expect(formatFileSize(3_100_000)).toBe("3.1 MB");
});
