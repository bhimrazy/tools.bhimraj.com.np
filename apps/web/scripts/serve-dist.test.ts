import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vercel from "../vercel.json";
import { createHandler, toSourcePattern } from "./serve-dist";

let dist: string;
let fetch: (req: Request) => Promise<Response>;
const get = (path: string) => fetch(new Request(`http://127.0.0.1${path}`));

beforeAll(async () => {
  dist = await mkdtemp(join(tmpdir(), "serve-dist-"));
  await mkdir(join(dist, "_astro"));
  await mkdir(join(dist, "forms"));
  await writeFile(join(dist, "index.html"), "home");
  await writeFile(join(dist, "404.html"), "missing");
  await writeFile(join(dist, "compress-image.html"), "tool");
  await writeFile(join(dist, "forms", "psc.html"), "form");
  await writeFile(join(dist, "_astro", "app.abc123.js"), "js");
  await writeFile(join(tmpdir(), "outside.txt"), "secret");
  fetch = createHandler(dist, vercel);
});
afterAll(() => rm(dist, { recursive: true, force: true }));

describe("toSourcePattern", () => {
  test("matches literal prefixes and (.*) groups over the whole path", () => {
    expect(toSourcePattern("/(.*)").test("/a/b.js")).toBe(true);
    const astro = toSourcePattern("/_astro/(.*)");
    expect(astro.test("/_astro/x.js")).toBe(true);
    expect(astro.test("/x/_astro/y.js")).toBe(false);
  });

  test("refuses syntax it does not implement", () => {
    expect(() => toSourcePattern("/:slug")).toThrow(/unsupported/);
    expect(() => toSourcePattern("/(a|b)")).toThrow(/unsupported/);
  });
});

describe("createHandler", () => {
  test("serves clean URLs with every vercel.json header", async () => {
    const res = await get("/compress-image");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("tool");
    for (const h of vercel.headers[0]!.headers)
      expect(res.headers.get(h.key)).toBe(h.value);
    expect(res.headers.get("Cache-Control")).toBeNull();
    expect(await (await get("/forms/psc")).text()).toBe("form");
    expect(await (await get("/")).text()).toBe("home");
  });

  test("redirects .html and trailing slashes to the clean URL", async () => {
    for (const [from, to] of [
      ["/compress-image.html", "/compress-image"],
      ["/compress-image/?q=1", "/compress-image?q=1"],
      ["/index.html", "/"],
      ["/index", "/"],
      ["/forms/index.html", "/forms"],
      ["/forms/", "/forms"],
    ]) {
      const res = await get(from!);
      expect(res.status).toBe(308);
      expect(res.headers.get("Location")).toBe(to!);
    }
  });

  test("marks hashed assets immutable", async () => {
    const res = await get("/_astro/app.abc123.js");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });

  test("answers unknown paths, directories and traversal with 404.html", async () => {
    for (const path of [
      "/nope",
      "/_astro",
      "/../outside.txt",
      "/%2e%2e/outside.txt",
      "//example.com/",
    ]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("missing");
      expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    }
  });

  test("refuses vercel.json settings it would serve differently", () => {
    expect(() => createHandler(dist, { ...vercel, redirects: [] })).toThrow(
      /not supported/,
    );
    expect(() =>
      createHandler(dist, { ...vercel, cleanUrls: false }),
    ).toThrow();
  });
});
