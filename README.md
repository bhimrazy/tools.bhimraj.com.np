# tools

Private, in-browser image and PDF tools, with exact presets for exam and government
upload forms. Files never leave your device.

Live at [tools.bhimraj.com.np](https://tools.bhimraj.com.np).

## Layout

```
apps/
  web/          Astro static site with React islands: one page per tool and per form (/forms/{cc}/{org}/{form})
packages/
  image/        in-browser image processing in a worker (later siblings: pdf, carbon)
  presets/      sourced registry of form size rules: pixels, KB limits, format, background
  site/         SITE_ORIGIN, URL and repo-link helpers; the only place the host is configured
  tsconfig/     shared compiler settings
bench/          image benchmark harness (Vite page driven by Playwright)
docs/adr/       architecture decisions
```

Hosted on Vercel and deployed from GitHub Actions; see [docs/deployment.md](docs/deployment.md).

Planned channels reuse `packages/image`: `apps/extension`, `apps/android` (TWA) and `apps/widget`.

## Develop

Requires [Bun](https://bun.com) 1.4.4 (pinned in `package.json`).

```sh
bun install
bun run dev        # web app
bun run verify         # format check, host check, typecheck, tests, build
```

Bun's built-ins do the toolchain work: `bun fmt`, `bun check`, `bun test`, `bun run --filter`.

## Testing

```sh
bun run build && bun run e2e   # Playwright against the built site (serve-dist on :4402)
bun run bench                  # on-device image benchmark, 4x CPU throttle; not run in CI
```

`bun run --filter @tools/web preview` serves the build with the production headers from
`apps/web/vercel.json`. First run needs `bunx playwright install chromium`. Set `BROWSER_PATH` to use
an existing Chromium. The benchmark serves on :4403, so both can run at once.

## License

Copyright © 2026 Bhimraj Yadav. All rights reserved. This repository is published for
viewing only; see [LICENSE](LICENSE).
