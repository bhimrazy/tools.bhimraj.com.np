/// <reference types="bun" />
// Fails if built HTML has anything our `script-src 'self'; style-src 'self'` header blocks:
// inline <script>/<style>, style="" attributes, on* handlers or javascript: URLs.
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
console.log(`CSP check: ${files.length} HTML files, no inline scripts/styles.`);
