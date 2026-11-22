# 0005: React islands with shadcn/ui on Base UI

Status: accepted (2026-11-22). Supersedes the Preact choice in 0001; the rest of 0001 stands.

## Decision

- Tool islands use **React 19** through `@astrojs/react`. Content pages still ship no JavaScript:
  only pages with a tool island load a script.
- UI controls come from **shadcn/ui, Base UI variant** (`components.json` `style: base-nova`),
  added with the shadcn CLI pinned as a dev dependency. Their source lives in
  `apps/web/src/components/ui`; icons are `lucide-react`, imported one file per icon.
- Islands are **not** hydrated with `client:*` directives. Those emit an inline `<script>` and
  `<style>` that `script-src 'self'; style-src 'self'` blocks. Instead `Island.astro` server-renders
  the component with a fixed `useId` prefix (unique per tool, since a form page holds one per upload),
  and `hydrateRoot` uses the same prefix (`src/lib/hydrate.ts`). Ids from Base UI then match.
- Island code loads **on first use**, not on page load (`src/lib/load-island.ts`): pointer, touch,
  focus, key, drag or paste on the tool. The server HTML already works, so a file picked, dropped or
  pasted before the code arrives is kept and handed to the tool when it mounts. This keeps a tool
  page within the product standard of 50 KB gzip before a file is chosen.
- Every island is wrapped in Base UI's `CSPProvider` with `disableStyleElements`, so it never
  inserts a `<style>`; the one rule it needs is in `global.css`.
- Controls that server-render a `style=""` attribute (Base UI `Select`, `Slider`) are rendered only
  after hydration. React then sets their styles through the CSSOM, which the CSP allows.
  `scripts/check-csp.ts` fails the build if a style attribute reaches the HTML.

## Why

shadcn/ui gives accessible, owned-source components (focus handling, keyboard support, ARIA)
that we would otherwise write by hand, and it targets React. Base UI is the primitive layer
shadcn now offers alongside Radix; it is MIT, maintained, and its CSP provider lets it run
under our policy. Preact with `preact/compat` would save bytes but is not a supported target for
these components.

## Cost

JavaScript on a tool page, measured on the built output (entry plus static imports):

| Page                             | Before (Preact)       | After (React)         |
| -------------------------------- | --------------------- | --------------------- |
| Home, 404                        | 0                     | 0                     |
| Compress and form pages: on load | 22.2 KiB (9.8 KiB gz) | 3.1 KiB (1.5 KiB gz)  |
| Same, on first use of the tool   | 1.2 KiB (0.7 KiB gz)  | 288 KiB (95.2 KiB gz) |
| Same, after hydration (lazy)     | none                  | 143 KiB (49.1 KiB gz) |

React DOM is about 68 KiB of the first-use load. The format select and the exact-size tooltip
(Base UI's positioning code) load after hydration with `React.lazy`. The image worker is unchanged.
The first-use load starts when someone touches the tool, which is usually before the file picker
closes; on a slow connection the tool may need a moment to respond to its first click.

Only the components a page uses are installed (button, input, select, tooltip); others are added
with `bunx shadcn add` when a feature needs them.

Since the v4 layout (home launcher, form kits) every page also loads `/theme.js` (about 1 KiB gz),
and home is a tool page: on load it ships the launcher's loader and the recent-forms script (about
2.5 KiB gz with `theme.js` and the shared preload helper); React loads on first use, as above.

## Revisit

If a 2–3 GB Android phone misses the ~3 s target for a 12 MP photo because of main-thread
work, or if search needs JavaScript on content pages.
