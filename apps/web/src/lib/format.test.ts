import { expect, test } from "bun:test";
import { getPreset, type Preset } from "@tools/presets";
import { formatChecked, formatSizeRule, getNativeCountry } from "./format";

const photo = getPreset("np-psc-lok-sewa-application-photo") as Preset;

test("formatSizeRule joins pixels and the KB window", () => {
  expect(formatSizeRule(photo.rule)).toBe("300 × 350 px · 10–200 KB");
});

test("formatChecked says when a rule was checked, or that it was not", () => {
  expect(formatChecked({ ...photo, verifiedAt: null })).toBe("Not checked");
  expect(formatChecked({ ...photo, verifiedAt: "2026-10-14" })).toBe(
    "Checked 14 Oct 2026",
  );
});

test("getNativeCountry gives the name in its own script, or null", () => {
  expect(getNativeCountry("NP")).toEqual({
    lang: "ne",
    script: "deva",
    name: "नेपाल",
  });
  expect(getNativeCountry("BD")?.script).toBe("beng");
  expect(getNativeCountry("US")).toBeNull();
});
