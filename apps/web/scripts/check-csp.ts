/// <reference types="bun" />
// Fails if vercel.json's CSP for every path loosens a directive the privacy promise depends on,
// or if built HTML has anything that policy blocks: inline <script>/<style>, style=""
// attributes, on* handlers or javascript: URLs.
import vercel from "../vercel.json";

const REQUIRED = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
];
const rules: [string, RegExp][] = [
  ["inline <script>", /<script(?![^>]*\bsrc=)[^>]*>/gi],
  ["inline <style>", /<style[\s>]/gi],
  ["style attribute", /<[a-z][^>]*\sstyle=/gi],
  ["event handler attribute", /<[a-z][^>]*\son[a-z]+=/gi],
  ["javascript: URL", /javascript:/gi],
];

const dist = new URL("../dist/", import.meta.url).pathname;
const files: string[] = [];
for await (const f of new Bun.Glob("**/*.html").scan(dist)) files.push(f);
const problems: string[] = [];
const csp = vercel.headers
  .find((r) => r.source === "/(.*)")
  ?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
const directives = new Set(csp?.split(";").map((d) => d.trim()));
if (!csp) problems.push('vercel.json: no Content-Security-Policy on "/(.*)"');
for (const d of REQUIRED) {
  if (csp && !directives.has(d))
    problems.push(`vercel.json CSP: missing "${d}"`);
}
for (const f of files) {
  const html = await Bun.file(dist + f).text();
  for (const [name, re] of rules) {
    const n = html.match(re)?.length ?? 0;
    if (n) problems.push(`${f}: ${n} × ${name}`);
  }
}
if (!files.length) problems.push("no HTML in dist; run the build first");
if (problems.length) {
  console.error(`CSP check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `CSP check: vercel.json policy intact; ${files.length} HTML files, no inline scripts/styles.`,
);
