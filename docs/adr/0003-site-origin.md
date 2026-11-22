# 0003: One configurable site origin

Status: accepted (2026-11-17)

`tools.bhimraj.com.np` is the canonical host; `bhimraj.com.np/tools` is a doorway page
that links (and redirects) here. Tools never run in both places.

So a later move to a brand domain is a config change plus redirects:

- Every absolute URL (canonical, hreflang, sitemap, Open Graph, manifest) goes through
  `@tools/site`, which reads `SITE_ORIGIN` at build time.
- The host string appears only in `packages/site/src/origin.ts` (the hosting config no
  longer needs it; see [0006](0006-vercel-hosting.md)); `scripts/check-host.ts` enforces it in CI.
- Paths are host-neutral: no `/tools` prefix and no personal name in routes.
