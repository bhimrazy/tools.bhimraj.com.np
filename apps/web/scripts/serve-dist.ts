/// <reference types="bun" />
// Serves ./dist the way Vercel does with our vercel.json: its `headers`, `cleanUrls` and
// `trailingSlash: false`, and 404.html for unknown paths. The e2e suite and `bun run preview`
// use it, so the CSP under test is the one that ships. Only the vercel.json features we use are
// supported; anything else throws instead of being served differently from production.
import { join, normalize } from "node:path";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
export interface VercelConfig {
  cleanUrls?: boolean;
  trailingSlash?: boolean;
  headers?: HeaderRule[];
  [key: string]: unknown;
}

const SUPPORTED = new Set([
  "$schema",
  "git",
  "cleanUrls",
  "trailingSlash",
  "headers",
]);

/** Turns a `source` made of literal segments and `(.*)` groups into a full-path RegExp. */
export function toSourcePattern(source: string): RegExp {
  const parts = source.split("(.*)");
  for (const p of parts) {
    if (/[:()*?+{}]/.test(p))
      throw new Error(`serve-dist: unsupported source syntax in "${source}"`);
  }
  const escaped = parts.map((p) => p.replace(/[.\\^$|[\]]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`);
}

export function createHandler(dist: string, config: VercelConfig) {
  for (const key of Object.keys(config)) {
    if (!SUPPORTED.has(key))
      throw new Error(`serve-dist: vercel.json "${key}" is not supported`);
  }
  if (config.cleanUrls !== true || config.trailingSlash !== false)
    throw new Error("serve-dist: expects cleanUrls true, trailingSlash false");
  const rules = (config.headers ?? []).map((r) => ({
    pattern: toSourcePattern(r.source),
    headers: r.headers,
  }));
  const root = normalize(join(dist, "/"));

  const withHeaders = (path: string, res: Response) => {
    for (const r of rules) {
      if (!r.pattern.test(path)) continue;
      for (const h of r.headers) res.headers.set(h.key, h.value);
    }
    return res;
  };
  const redirect = (url: URL, path: string) =>
    new Response(null, {
      status: 308,
      headers: { Location: path + url.search },
    });
  const fileAt = async (rel: string) => {
    const full = normalize(join(root, rel));
    if (!full.startsWith(root) || full === root) return null;
    const file = Bun.file(full);
    // A directory reports exists() false for Bun.file, so this only matches files.
    return (await file.exists()) ? file : null;
  };

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    let path: string;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Same order as Vercel's cleanUrls/trailingSlash routes, which run before `headers`, so
    // these 308s carry no custom headers there either.
    const index = path.match(/^\/(?:(.+)\/)?index(?:\.html)?\/?$/);
    if (index) return redirect(url, `/${index[1] ?? ""}`);
    const html = path.match(/^\/(.*)\.html\/?$/);
    if (html) return redirect(url, `/${html[1]}`);
    if (path.length > 1 && path.endsWith("/"))
      return redirect(url, path.slice(0, -1));

    const file =
      (path === "/" ? null : await fileAt(path)) ??
      (await fileAt(`${path}.html`)) ??
      (await fileAt(join(path, "index.html")));
    if (file) return withHeaders(path, new Response(file));
    const notFound = await fileAt("404.html");
    return withHeaders(
      path,
      new Response(notFound ?? "Not Found", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );
  };
}

if (import.meta.main) {
  const flag = process.argv.indexOf("--port");
  const port = Number(
    (flag > 0 ? process.argv[flag + 1] : process.env.PORT) ?? 4402,
  );
  const dir = new URL("../", import.meta.url).pathname;
  const config = await Bun.file(join(dir, "vercel.json")).json();
  const fetch = createHandler(join(dir, "dist"), config);
  const server = Bun.serve({ port, hostname: "127.0.0.1", fetch });
  console.log(`serve-dist: ${server.url.href} (dist with vercel.json)`);
}
