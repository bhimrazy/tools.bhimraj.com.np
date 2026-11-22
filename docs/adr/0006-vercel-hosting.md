# 0006: Host on Vercel, deployed from GitHub Actions

Status: accepted (2026-11-22). Supersedes the hosting part of [0001](0001-stack.md) (Cloudflare Workers
static assets) and the `wrangler.jsonc` part of [0003](0003-site-origin.md).

- **Vercel static hosting.** The site stays static output with no server code. Vercel project `tools`
  (root directory `apps/web`, framework Astro) serves `dist`.
- **`apps/web/vercel.json` is the one source of truth** for response headers (CSP and the other security
  headers, immutable caching for `/_astro/*`), `cleanUrls` and `trailingSlash: false`. `public/_headers`
  and `wrangler.jsonc` are gone.
- **Local serving reads the same file.** `apps/web/scripts/serve-dist.ts` is a small Bun server that serves
  `dist` with `vercel.json`'s headers and clean-URL redirects, in the order Vercel applies them. The e2e
  suite and `bun run preview` use it, so the tested CSP is the shipped one. It refuses `vercel.json`
  settings it doesn't implement rather than serving them differently. We chose this over running
  `vercel dev`, which needs a linked project and login, and over Wrangler, which would mean a second
  headers file.
- **Deploys come only from Actions** (`git.deploymentEnabled: false`): previews for PRs, production after
  CI passes on main, using a Vercel CLI pinned in `.github/vercel-cli` with its own lockfile. The build
  step never holds the token. See [deployment.md](../deployment.md).
- **Host-neutral as before.** Domains are attached in Vercel, not in the repo; the host string now lives
  only in `packages/site/src/origin.ts`.
