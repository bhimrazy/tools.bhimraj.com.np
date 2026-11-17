# Agent guide

Private, in-browser image/PDF tools with exact form presets (Lok Sewa, Teletalk, DV…).
Read `README.md` for the layout and `docs/adr/` for decisions before changing structure.

## Principles

- **Files never leave the device.** No network calls from tool code, no third-party
  scripts, fonts or analytics on tool pages. The CSP in `apps/web/public/_headers`
  (`connect-src 'self'`) must keep passing.
- **Low-end Android first.** Target a 2–3 GB phone: one job at a time, workers
  terminated when idle, decoded images kept under 16,777,216 px (iOS canvas cap),
  heavy code loaded only via dynamic `import()` when a tool needs it.
- **Specs are the product.** Every preset in `packages/presets` cites a source and a
  `verifiedAt` date, or is `null` and shown as unverified. Never invent a figure.
- **Host-neutral.** The production host lives only in `packages/seo/src/origin.ts`
  and `apps/web/wrangler.jsonc`; `bun run check:host` fails otherwise.
- **Permissive dependencies only** (MIT/BSD/Apache/MPL) until the v2 licence decision;
  no AGPL engines, no non-commercial models.

## Conventions

- Bun built-ins only: `bun fmt`, `bun check`, `bun test`, `bun run --filter`.
  No Biome, ESLint, Prettier, Turbo or Vitest.
- Packages are source-only TypeScript (`exports` point at `src/`), scope `@tools/*`.
- Exact versions; shared ones go in the root `workspaces.catalog`. `bunfig.toml`
  refuses releases younger than 7 days; don't bypass it.
- CI actions are pinned to full commit SHAs with a version comment.
- Rust/WASM only for a measured hot path; see `docs/adr/0004-rust-wasm.md`.
- Research and business notes go in `.research/` (gitignored), never in the repo.

## Validation

Run before handing off; it is what CI runs:

```sh
bun run verify
```
