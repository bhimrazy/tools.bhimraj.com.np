import { expect, test } from "bun:test";
import {
  DEFAULT_SITE_ORIGIN,
  NEW_ISSUE_URL,
  absoluteUrl,
  hreflangAlternates,
  reportRuleUrl,
  siteOrigin,
} from "./index";

const origin = new URL("https://example.test");

test("siteOrigin falls back to default and accepts origins", () => {
  expect(siteOrigin("").href).toBe(`${DEFAULT_SITE_ORIGIN}/`);
  expect(siteOrigin(" ").origin).toBe(DEFAULT_SITE_ORIGIN);
  expect(siteOrigin("http://localhost:4321/").origin).toBe(
    "http://localhost:4321",
  );
});

test("siteOrigin rejects non-origins", () => {
  for (const bad of [
    "example.test",
    "ftp://example.test",
    "https://example.test/a",
    "https://example.test/?q=1",
    "https://example.test/#x",
    "https://u:p@example.test",
  ]) {
    expect(() => siteOrigin(bad)).toThrow(/SITE_ORIGIN/);
  }
});

test("absoluteUrl joins safely", () => {
  expect(absoluteUrl("np/a", origin)).toBe("https://example.test/np/a");
  expect(absoluteUrl("/np/a/", origin)).toBe("https://example.test/np/a/");
  expect(absoluteUrl("//np/a?x=1#h", origin)).toBe(
    "https://example.test/np/a?x=1#h",
  );
  expect(absoluteUrl("", origin)).toBe("https://example.test/");
});

test("hreflangAlternates includes x-default at the unprefixed path", () => {
  const locales = [
    { hreflang: "en", prefix: "" },
    { hreflang: "ne", prefix: "/ne/" },
  ];
  expect(hreflangAlternates("/np/a", locales, origin)).toEqual([
    { hreflang: "en", href: "https://example.test/np/a" },
    { hreflang: "ne", href: "https://example.test/ne/np/a" },
    { hreflang: "x-default", href: "https://example.test/np/a" },
  ]);
});

test("absoluteUrl never leaves the site origin", () => {
  expect(absoluteUrl("//evil.example/x", origin)).toBe(
    "https://example.test/evil.example/x",
  );
  expect(absoluteUrl("/\\evil.example/x", origin)).toBe(
    "https://example.test/evil.example/x",
  );
});

test("reportRuleUrl prefills a size rule issue", () => {
  const url = new URL(reportRuleUrl("Lok Sewa photo", "/forms/np/psc/x"));
  expect(url.href.startsWith(NEW_ISSUE_URL)).toBe(true);
  expect(url.searchParams.get("title")).toBe(
    "Size rule changed: Lok Sewa photo",
  );
  expect(url.searchParams.get("body")).toStartWith("Page: /forms/np/psc/x\n");
});
