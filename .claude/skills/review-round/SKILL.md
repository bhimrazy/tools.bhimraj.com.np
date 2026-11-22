---
name: review-round
description: Run the tools-site review round — CTO, CEO, security, product and SEO reviewers in parallel, read-only — then turn findings into fixes or issues and report to the owner. Use when the owner asks for a review round.
disable-model-invocation: true
---

# Review round

Never more than 5 agents running at once, counting reviewers and fix tracks together.

1. **Check the ground.** The branch is committed and pushed (worktrees and `gh` need that), the tree is clean, and
   `git check-ignore -q .research` succeeds. Stop and tell the owner if not. `mkdir -p .research/reviews`.

2. **Prepare once.** `bun run verify`; then `bun run bench` if that script exists. Serve the build with
   `bun run --filter @tools/web preview` and note the URL. With the chrome-devtools MCP, capture the hub, each tool
   page and one preset page per kind and country at 1440 and 360, light and dark, into a scratch directory.

3. **Launch in parallel, in the background, in one message:** `cto-advisor`, `ceo-advisor`, `security-reviewer`,
   `product-reviewer`, `seo-reviewer`. Give each the date, the base URL, the screenshot directory and the path of its
   previous review. Each writes `.research/reviews/<YYYY-MM-DD>-<kind>.md`; none edits code or starts a server.

4. **Consolidate.** Read the five files; group findings by area and dedupe. Fix now: owner-blocking items and anything
   touching privacy, a wrong spec or a false claim. Everything else becomes a GitHub issue, written as a plain
   engineering task. Public text (issues, PRs, commits) never carries strategy, market, revenue or competitor detail,
   and never an unfixed security finding; those stay in `.research/` for the owner.

5. **Fix in waves.** Split fixes into tracks that touch different files; each runs in its own worktree under
   `.claude/worktrees/<track>` on its own branch and port, one PR per track: `engineer` for code,
   `principal-designer` for UI, `spec-researcher` for presets. When a wave's PRs are merged, re-run `bun run verify`
   and the screenshot pass on the result and compare with step 2.

6. **Report to the owner** in under ten lines: what changed, PR links, what's still open, the decisions they need to
   make. Report only what actually ran.

7. **Clean up.** Leave PRs open for the owner unless they asked you to merge. Stop every server you started (by port
   PID), `git worktree remove` each finished worktree and delete merged branches.
