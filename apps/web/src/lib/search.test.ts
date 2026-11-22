import { expect, test } from "bun:test";
import {
  parseQuery,
  type SearchEntry,
  searchEntries,
  toCustomRuleHref,
} from "./search";

const lokSewa: SearchEntry = {
  type: "form",
  title: "Lok Sewa Aayog online application photo",
  href: "/forms/np/psc/lok-sewa-application#photo",
  detail: "",
  terms: "lok sewa aayog online application photo लोक सेवा आयोग nepal नेपाल",
  width: 300,
  height: 350,
  minKb: 10,
  maxKb: 200,
};
const teletalk: SearchEntry = {
  type: "form",
  title: "Teletalk job application photo",
  href: "/forms/bd/teletalk/job-application#photo",
  detail: "",
  terms: "teletalk job application photo টেলিটক bangladesh বাংলাদেশ",
  width: 300,
  height: 300,
  maxKb: 100,
};
const compress: SearchEntry = {
  type: "tool",
  title: "Compress to KB",
  href: "/compress-image",
  detail: "",
  terms: "compress image size kb reduce smaller",
};
const all = [lokSewa, teletalk, compress];

test("reads a print size and a limit", () => {
  expect(parseQuery("35x45 50kb")).toEqual({
    width: 35,
    height: 45,
    unit: "mm",
    maxKb: 50,
    words: [],
  });
});

test("reads pixels, MB and phrases", () => {
  expect(parseQuery("300 × 350 px")).toMatchObject({
    width: 300,
    height: 350,
    unit: "px",
  });
  expect(parseQuery("under 1 MB").maxKb).toBe(1000);
  expect(parseQuery("photo under 100 kb")).toEqual({
    maxKb: 100,
    words: ["photo"],
  });
});

test("matches names in Nepali and Bengali", () => {
  expect(searchEntries(all, parseQuery("लोक सेवा"))).toEqual([lokSewa]);
  expect(searchEntries(all, parseQuery("টেলিটক"))).toEqual([teletalk]);
  expect(searchEntries(all, parseQuery("Lok Sewa"))).toEqual([lokSewa]);
});

test("a limit alone finds the forms that allow it, exact size first", () => {
  expect(searchEntries(all, parseQuery("under 100 kb"))).toEqual([
    lokSewa,
    teletalk,
  ]);
  expect(searchEntries(all, parseQuery("300x300 100kb"))[0]).toBe(teletalk);
  expect(searchEntries(all, parseQuery("35x45 50kb"))).toEqual([]);
});

test("words must all match", () => {
  expect(searchEntries(all, parseQuery("passport photo"))).toEqual([]);
  expect(searchEntries(all, parseQuery("compress"))).toEqual([compress]);
  expect(searchEntries(all, parseQuery(""))).toEqual([]);
});

test("custom rule link carries pixels only, never mm", () => {
  expect(toCustomRuleHref(parseQuery("300x350 px 50kb"))).toBe(
    "/compress-image?kb=50&w=300&h=350",
  );
  expect(toCustomRuleHref(parseQuery("35x45 50kb"))).toBe(
    "/compress-image?kb=50",
  );
  expect(toCustomRuleHref(parseQuery("lok sewa"))).toBeNull();
});
