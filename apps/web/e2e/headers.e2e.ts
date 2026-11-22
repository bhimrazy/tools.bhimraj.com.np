import { expect, test } from "@playwright/test";
import vercel from "../vercel.json" with { type: "json" };

const all = vercel.headers.find((r) => r.source === "/(.*)")!.headers;

test("pages, the 404 page and assets carry vercel.json's security headers", async ({
  request,
}) => {
  const home = await request.get("/");
  const asset = home.text().then((html) => html.match(/\/_astro\/[^"]+/)![0]);
  for (const path of ["/", "/compress-image", "/no-such-page", await asset]) {
    const res = await request.get(path);
    for (const h of all)
      expect(res.headers()[h.key.toLowerCase()]).toBe(h.value);
  }
  const csp = home.headers()["content-security-policy"];
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("script-src 'self';");
  const cached = await request.get(await asset);
  expect(cached.headers()["cache-control"]).toContain("immutable");
});

test("clean URLs: .html and trailing slashes redirect to the bare path", async ({
  request,
}) => {
  for (const [from, to] of [
    ["/compress-image.html", "/compress-image"],
    ["/compress-image/", "/compress-image"],
    ["/index.html", "/"],
  ]) {
    const res = await request.get(from!, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(to);
  }
});
