import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";
import { siteOrigin } from "@tools/seo";
import { defineConfig } from "astro/config";

// CSP: public/_headers ships `script-src 'self'; style-src 'self'` with no hashes.
// Astro `client:*` islands always inject an inline <script> + <style> (astro-island runtime),
// which that policy blocks, and Astro's `security.csp` only emits a <meta> policy, not our header.
// So islands are hydrated by a bundled module script instead (src/components/CompressIsland.astro),
// and nothing is inlined: stylesheets via `inlineStylesheets: "never"`, scripts and assets via
// `assetsInlineLimit: 0`. `bun run check:csp` fails the build output if an inline script/style slips in.
export default defineConfig({
  site: siteOrigin().href,
  output: "static",
  // "file" emits /compress-image.html, which Cloudflare's `drop-trailing-slash` html_handling
  // serves at /compress-image without a redirect, matching trailingSlash "never".
  trailingSlash: "never",
  build: { format: "file", inlineStylesheets: "never" },
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
    build: { assetsInlineLimit: 0 },
    // The image engine spawns `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`.
    worker: { format: "es" },
  },
});
