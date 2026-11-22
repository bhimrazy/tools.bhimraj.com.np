import { expect, test } from "bun:test";
import { kbToMaxBytes, kbToMinBytes } from "@tools/presets";
import { formatVerdict } from "./verdict";

const max100 = { maxBytes: kbToMaxBytes(100) }; // 99,000 bytes
const window10to200 = {
  minBytes: kbToMinBytes(10),
  maxBytes: kbToMaxBytes(200),
};

test("a pass names the form's limit", () => {
  expect(formatVerdict(47_250, max100)).toBe(
    "Done: 47.2 KB, under your 100 KB limit",
  );
  expect(formatVerdict(50_000, window10to200)).toBe(
    "Done: 50.0 KB, inside your 10–200 KB limit",
  );
});

test("over the limit by a clear margin compares with the limit", () => {
  expect(formatVerdict(120_300, max100)).toBe(
    "Too big: 121 KB. Your limit is 100 KB.",
  );
});

test("over the safe target but under the stated limit explains the margin", () => {
  expect(formatVerdict(99_500, max100)).toBe(
    "Too big: 99.5 KB. We aim for 99 KB or less, just under your 100 KB limit, so the form accepts it.",
  );
});

test("under the minimum, clearly or within the margin", () => {
  expect(formatVerdict(8_000, window10to200)).toBe(
    "Too small: 8.0 KB. The smallest allowed is 10 KB.",
  );
  expect(formatVerdict(10_200, window10to200)).toBe(
    "Too small: 10.2 KB. We aim for 10.4 KB or more, just over your 10 KB minimum, so the form accepts it.",
  );
});

test("no verdict reads as inside the limit when the file is outside it", () => {
  for (let bytes = 95_000; bytes < 101_000; bytes += 50) {
    const line = formatVerdict(bytes, max100);
    if (bytes > max100.maxBytes) expect(line).toStartWith("Too big");
    else expect(line).toStartWith("Done");
  }
});
