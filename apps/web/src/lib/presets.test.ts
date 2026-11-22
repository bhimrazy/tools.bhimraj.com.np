import { expect, test } from "bun:test";
import type { Preset } from "@tools/presets";
import { nativeCountry, ruleChecked, ruleLine } from "./presets";

const base: Preset = {
  id: "xx-test",
  path: "np/test",
  country: "NP",
  portal: "Test portal",
  title: "Test photo",
  kind: "photo",
  output: {
    format: "image/jpeg",
    width: 300,
    height: 350,
    minBytes: 10 * 1024,
    maxBytes: 200_000,
  },
  source: null,
  verifiedAt: null,
};

test("ruleLine joins pixels and the KB window", () => {
  expect(ruleLine(base)).toBe("300 × 350 px · 10–200 KB");
});

test("ruleChecked says when a rule was checked, or that it was not", () => {
  expect(ruleChecked(base)).toBe("Not checked");
  expect(ruleChecked({ ...base, verifiedAt: "2026-10-14" })).toBe(
    "Checked 14 Oct 2026",
  );
});

test("nativeCountry gives the name in its own script, or null", () => {
  expect(nativeCountry("NP")).toEqual({
    lang: "ne",
    script: "deva",
    name: "नेपाल",
  });
  expect(nativeCountry("BD")?.script).toBe("beng");
  expect(nativeCountry("US")).toBeNull();
});
