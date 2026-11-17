# tools

Private, in-browser image and PDF tools, with exact presets for exam and government
upload forms. Files never leave your device.

Live at [tools.bhimraj.com.np](https://tools.bhimraj.com.np).

## Layout

```
apps/
  web/          Astro static site: one page per tool and per form preset
packages/
  engines/      in-browser processing, one worker per engine family (image, later pdf, ai)
  presets/      sourced registry of form specs: pixels, KB limits, format, background
  seo/          SITE_ORIGIN and URL helpers; the only place the host is configured
  tsconfig/     shared compiler settings
bench/          engine benchmark harness (Vite page driven by Playwright)
docs/adr/       architecture decisions
```

Planned channels reuse `packages/engines`: `apps/extension`, `apps/android` (TWA) and `apps/widget`.

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
bun run build && bun run e2e   # Playwright against the built site (wrangler on :4402)
bun run bench                  # on-device engine benchmark, 4x CPU throttle; not run in CI
```

First run needs `bunx playwright install chromium`. Set `PW_CHROMIUM_PATH` to use an existing Chromium.

## License

Copyright © 2026 Bhimraj Yadav. All rights reserved. This repository is published for
viewing only; see [LICENSE](LICENSE).
