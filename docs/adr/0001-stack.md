# 0001: Stack

Status: accepted (2026-11-17)

- **Bun 1.4 workspaces and built-ins** (`fmt`, `check`, `test`, `--filter`, catalogs,
  `audit`) replace Biome, Turborepo, Vitest, syncpack and lefthook. Fewer tools, one
  version to pin. There is no built-in linter; strict `tsconfig` flags
  (`noUnused*`, `noImplicitReturns`, `exactOptionalPropertyTypes`) cover the gap.
  Revisit Turborepo if CI builds get slow enough to need caching (`--filter` has none).
  `bun fmt` and `bun check` skip `.astro` files: `astro check` type-checks them and
  they are formatted by hand. No root script may be named `fmt` or `check`, or the
  built-in runs that script instead.
- **Astro 7, static output, Preact islands, Tailwind 4.** Pages ship no JavaScript
  by default; only the tool island hydrates. Hundreds of preset pages come from
  `getStaticPaths` over `@tools/presets`. Next.js static export was rejected: it
  sends a React runtime to every page and its server features go unused.
- **Cloudflare Workers static assets.** Static output only, no server code;
  `_headers` sets a strict CSP. 25 MiB per file, 20,000 files on the free plan.
- **Source-only packages.** `exports` point at TypeScript sources; Vite compiles them
  in the app. No per-package build step.
