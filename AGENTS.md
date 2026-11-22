# Agent guide

Private, in-browser image/PDF tools with exact form presets (Lok Sewa, Teletalk, DV…).
Read `README.md` for the layout and `docs/adr/` for decisions before changing structure.

## Principles

- **Files never leave the device.** No network calls from tool code, no third-party
  scripts, fonts or analytics on tool pages. The CSP in `apps/web/vercel.json`
  (`connect-src 'self'`) must keep passing.
- **Low-end Android first.** Target a 2–3 GB phone: one job at a time, workers
  terminated when idle, decoded images kept under 16,777,216 px (iOS canvas cap),
  heavy code loaded only via dynamic `import()` when a tool needs it.
- **Presets are the product.** Every preset in `packages/presets` cites a source and a
  `verifiedAt` date, or is `null` and shown as not checked yet. Never invent a figure.
- **Host-neutral.** The production host lives only in `packages/site/src/origin.ts`;
  `bun run check:host` fails otherwise. Domains are attached in Vercel (`docs/deployment.md`).
- **Permissive dependencies only** (MIT/BSD/Apache/MPL) until the v2 licence decision;
  no AGPL libraries, no non-commercial models. Exception: fonts may be OFL-1.1, self-hosted and
  unmodified (Onest, Noto Sans Devanagari, Noto Sans Bengali).

## Conventions

- Bun built-ins only: `bun fmt`, `bun check`, `bun test`, `bun run --filter`.
  No Biome, ESLint, Prettier, Turbo or Vitest.
- Packages are source-only TypeScript (`exports` point at `src/`), scope `@tools/*`.
- Exact versions; shared ones go in the root `workspaces.catalog`. `bunfig.toml`
  refuses releases younger than 7 days; don't bypass it.
- CI actions are pinned to full commit SHAs with a version comment.
- Rust/WASM only for a measured hot path; see `docs/adr/0004-rust-wasm.md`.
- UI: React islands hydrated by our own module, never `client:*` (CSP); shadcn/ui on Base UI
  in `apps/web/src/components/ui`; `lucide-react` imported per icon. See `docs/adr/0005-react-islands.md`
  and `apps/web/DESIGN.md`. Colours come only from the theme block in `apps/web/src/styles/global.css`.
- Research and business notes go in `.research/` (gitignored). No strategy, market or revenue detail in commits,
  PRs, issues or `.claude/`.
- Third-party references (competitor or reference sites and repos, screenshots, inspiration notes) also live
  only in `.research/`. Code, comments, docs, ADRs, PRs and issues describe our own decisions without naming them.
  Preset `source` links are citations, not references, and stay.
- Agent roles live in `.claude/agents/`; `/review-round` runs the CTO, CEO, security, product and SEO reviewers.

## Naming

- One word per idea; see the glossary below. Retired: "engine", "spec". In code, "fit" is only the crop mode
  (`cover`/`contain`) and "fits" only means meeting the size rule. UI words come from the copy deck.
- Glossary: form = the application (e.g. Lok Sewa online application) · upload = one file a form asks for ·
  preset = sourced record for one upload · size rule (`SizeRule`) = its numbers · limit = `maxBytes` ·
  attempt = one encode ("try" in UI) · job = one `compress()` call · `ImageWorker` = the main-thread handle ·
  kit = a form's list of slots · slot = one upload in a kit.
- Packages are named by capability (`@tools/image`, later `@tools/pdf`), not by layer.
- Files: kebab-case modules named by job; PascalCase components; `x.test.ts` beside `x.ts`; browser tests
  `*.e2e.ts`. No `utils`, `helpers`, `misc` or `common`.
- Functions start with a verb (`get`, `read`, `format`, `to`, `compute`, `search`). `create*` returns an object
  that owns resources and has `dispose()`; `open*` connects to persisted storage, is async and has `close()`.
- Units in names: bytes are `*Bytes`, durations `*Ms`, memory `*MiB`. KB exists only at the input/display edge
  (`KB = 1000`, `KIB = 1024`, `kbToMaxBytes`, `maxBytesToKb`).
- Errors: `<Capability>Error` with a snake_case `code` naming the condition (`too_many_pixels`).
- Routes: `/{verb}-{object}` for tools; `/forms/{cc}/{org}/{form}` for forms, one page per form with each upload a
  `#{upload}` section. Build them with `formPath()`/`uploadPath()`; never store a URL in data.
- No third-party product names in our identifiers.

## Validation

Run before handing off; it is what CI runs:

```sh
bun run verify
```

CI also runs the browser suite (`bun run build && bun run e2e`) after `check`; run it when you touch UI,
`packages/image` or `vercel.json`. Browser tests (`*.e2e.ts`) live in `apps/web/e2e` and assert behaviour, not
markup classes.
