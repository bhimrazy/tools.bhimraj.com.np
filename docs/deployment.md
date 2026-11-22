# Deployment

The site is static. Vercel serves `apps/web/dist`, and GitHub Actions does every deploy:
Vercel's Git integration is off (`git.deploymentEnabled: false` in `apps/web/vercel.json`). Why: [ADR 0006](adr/0006-vercel-hosting.md).

| Workflow             | When                                                | Does                                          |
| -------------------- | --------------------------------------------------- | --------------------------------------------- |
| `preview.yml`        | Each push to a ready-for-review PR from this repo   | Preview deploy and a comment with its URL     |
| `production.yml`     | After CI passes on a push to `main`, or run by hand | Production deploy, skipped when nothing ships |
| `vercel-cleanup.yml` | By hand from `main`                                 | Deletes old deployments after approval        |

The Vercel project is `tools`: root directory `apps/web`, framework Astro, install
`bun install --frozen-lockfile`, build `bun run build`, output `dist`. It serves production at
`tools.bhimraj.com.np` (see [Domains](#domains)).

## Headers and URLs

`apps/web/vercel.json` holds the CSP, the other security headers, immutable caching for `/_astro/*`,
`cleanUrls` and `trailingSlash: false`. Change headers there only. `bun run build` fails if the
CSP loses a required directive, and the e2e suite runs against `apps/web/scripts/serve-dist.ts`,
which applies the same file. `bun run --filter @tools/web preview` serves the build the same way.

## Environments and secrets

Settings → Environments. Secret names only; values live in GitHub.

| Environment         | Used by                                                   | Branch policy | Secrets                                              |
| ------------------- | --------------------------------------------------------- | ------------- | ---------------------------------------------------- |
| `vercel-preview`    | `preview.yml`                                             | None          | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `vercel-production` | `production.yml`, `vercel-cleanup.yml` (`plan`, `delete`) | `main` only   | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `vercel-cleanup`    | `vercel-cleanup.yml` (`approve`)                          | `main` only   | None; a required reviewer                            |

Don't add a branch policy to `vercel-preview`, or previews stop. PR branches can read whatever
`vercel-preview` holds, so put nothing there that only production may use. Both environments
currently hold the same team-scoped token, and a team-scoped token can deploy to production, so a
PR branch from this repo could do so. Fork and Dependabot PRs get no secrets. Treat the preview
token as a production credential. The full fix is a separate preview project with its own token.

## Previews

Opening, pushing to or marking ready a non-draft PR from this repository deploys a preview. The
workflow then posts the URL in a PR comment and updates that comment on later pushes. A newer push
cancels the deploy in flight. PRs that change only docs, Markdown, e2e tests or the benchmark don't
deploy. Preview URLs sit behind Vercel's Deployment Protection (team sign-in) and send
`X-Robots-Tag: noindex`; their canonical links point at production.

## Production

After CI succeeds on a push to `main`, `production.yml` checks out the commit CI tested. Before
deploying, it asks the Vercel API for the newest ready production deployment that has a
`meta.githubCommitSha`, which this workflow sets with `--meta` on every deploy. Deploys made any
other way don't have one, so they are passed over, and comparing with an older commit can only
deploy more. It then:

- deploys when no production deployment carries the meta yet (the first merge after this setup);
- **skips** when only docs, Markdown, tests, the benchmark, repo scripts or `.github/` changed
  (a Vercel CLI bump still deploys). The next merge that ships deploys everything;
- **skips with a warning** when Vercel can't be read or the recorded commit isn't in the
  checkout. It fails closed, so run it by hand.

To deploy by hand, go to Actions → **Vercel Production** → Run workflow on `main`. A manual run
deploys `main`'s head once CI has passed on it.

Each deploy runs as two jobs. `build` runs repository code (install, `vercel build`) and gets the
token only for `vercel pull`, which runs before any of that code. It uploads `.vercel/output` as an
artifact. `deploy` holds the token but checks out only `.github/vercel-cli`, so it runs nothing
but the pinned CLI: `vercel deploy --prebuilt --archive=tgz`. The Vercel CLI version is pinned in
`.github/vercel-cli/package.json`, with its own frozen lockfile and the 7-day cooldown, and
Dependabot bumps it. CI audits that lockfile at `critical`, because the CLI's exact-pinned
dependencies carry known high-severity DoS advisories that no release past the cooldown fixes yet.
An override pins `tar` to a patched 7.5 release. Production also skips a commit that doesn't
descend from the live one, so re-running an old CI run can't roll production back.

**Rollback:** in Vercel → Deployments, promote the previous production deployment. The next
automatic deploy compares against the newest ready production deployment, so it still ships every
change since then.

## Old deployments

Actions → **Vercel Cleanup** → Run workflow on `main`, and choose how many ready production
deployments to keep (default 3). `plan` lists what it would delete in the run summary. The live
deployment, read from the project's current production target, always stays. `approve` waits for
the required reviewer in `vercel-cleanup`. `delete` then removes the list, skipping any deployment
that went live in the meantime. You can restore a deleted deployment for a while in project
Settings → Security → Recently Deleted Deployments.

## Rotating the Vercel token

The token is team-scoped and **expires 2027-11-22**. Nothing rotates it automatically. Before it
expires, or if it may have leaked:

1. In Vercel → Account Settings → Tokens, create a token scoped to the team, with an expiry.
2. Replace `VERCEL_TOKEN` in both `vercel-preview` and `vercel-production`.
3. Run **Vercel Production** by hand on `main` and check it deploys.
4. Delete the old token in Vercel.

## Domains

Domains are configured in Vercel only (project `tools` → Settings → Domains). No workflow or app
code reads them. The canonical host comes from `packages/site/src/origin.ts`.

- `tools.bhimraj.com.np` is the production domain, verified by `CNAME` with HTTPS and HSTS.
  Every production deploy is aliased to it automatically.
- `tools-bhimraj.vercel.app` and `tools-omega-ten.vercel.app` redirect to it with a 308.
- Check it: `curl -sI https://tools.bhimraj.com.np/compress-image` shows `content-security-policy`
  and a 200, and `/compress-image.html` answers 308. `//example.com/` redirects to the same-origin
  `/example.com/`, not off-site (`serve-dist` answers such paths with a 404).
- To move hosts later, add the new domain in Vercel and make the old one redirect to it. Then
  change `origin.ts`; see [ADR 0003](adr/0003-site-origin.md).
