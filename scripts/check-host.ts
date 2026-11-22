// Fails if the production hostname is hard-coded outside the one place it may live,
// so a move to a brand domain stays a config change (see docs/adr/0003-site-origin.md).
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const HOST = "bhimraj.com.np";
// The GitHub repo is named after the host; links to it are fine.
const REPO = /github\.com\/bhimrazy\/tools\.bhimraj\.com\.np/g;
const ALLOWED = new Set(["packages/site/src/origin.ts"]);

const files = await Array.fromAsync(
  new Bun.Glob(
    "{apps,packages,.github}/**/*.{ts,tsx,astro,js,mjs,json,jsonc,css,html,svg,xml,txt,md,mdx,webmanifest,yml,yaml,sh}",
  ).scan({ cwd: ROOT, dot: true }),
);
const scanned = files.filter(
  (f) => !f.includes("node_modules/") && !f.includes("/dist/"),
);
if (scanned.length === 0) {
  console.error("check-host scanned no files; the glob or root is wrong.");
  process.exit(1);
}
const hits: string[] = [];
for (const f of scanned) {
  if (ALLOWED.has(f)) continue;
  const text = await Bun.file(join(ROOT, f)).text();
  if (text.replace(REPO, "").includes(HOST)) hits.push(f);
}
if (hits.length) {
  console.error(
    `Hostname "${HOST}" is hard-coded in:\n  ${hits.join("\n  ")}\nUse SITE_ORIGIN via @tools/site.`,
  );
  process.exit(1);
}
console.log(`check-host: ${scanned.length} files clean`);
