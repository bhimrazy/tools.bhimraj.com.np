---
name: review-round
description: Run the tools-site review round — CTO, CEO, security, product and design reviewers in parallel, read-only — then turn findings into fixes or issues and report to the owner. Use when the owner asks for a review round or before merging a large branch.
---

# Review round

1. **Prepare once.** `bun run verify`, then serve the build (`bunx wrangler dev` in `apps/web`) and run `bun run bench`.
   Capture every route at 1440 and 360, light and dark, into a scratch directory. Reviewers read these instead of each
   starting a server.

2. **Launch in parallel, in the background, in one message** (at most 5 agents at once): `cto-advisor`, `ceo-advisor`
   (includes market research), `security-reviewer`, `product-reviewer` and `principal-designer` in critique mode. Give
   each the date, the screenshot directory and its previous review file. Each writes
   `.research/reviews/<YYYY-MM-DD>-<kind>.md` (gitignored); none edits code.

3. **Consolidate.** Group findings by area and dedupe them. Owner-blocking items and anything touching privacy, a wrong
   spec or a false claim become fix work now; the rest become GitHub issues (no strategy or market detail in public
   issues).

4. **Fix in waves.** Split the fixes into tracks that don't touch the same files and run them in parallel, each in its
   own worktree under `.claude/worktrees/<track>` with the `engineer` role (5 agents at most), one PR per track. Re-run
   `bun run verify` and the screenshot pass on the merged result and compare with step 1.

5. **Report to the owner** in under ten lines: what changed, what's still open, and the decisions they need to make.
   Report only what actually ran.

6. **Clean up.** Merge the track PRs, `git worktree remove` each worktree, delete merged branches, and stop every dev
   server you started.
