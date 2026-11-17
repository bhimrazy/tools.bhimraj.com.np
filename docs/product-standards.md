# Product standards

Hard checks for anything user-facing. An owner correction that isn't here yet becomes a new line.

## Privacy

- No file content, file name or derived data leaves the device. Tool pages make no cross-origin requests (e2e enforced).
- No third-party scripts, fonts, analytics or ads on tool pages.
- Every privacy claim on the site is true today and checkable (airplane mode works once cached).

## Specs

- Every preset shows its source and "Last verified <date>", or a visible "Unverified" badge.
- Output meets the preset exactly: pixel size, format, byte window and background. Never a centre-crop that cuts off a
  signature.
- Sizes are shown the way the portal states them (KB), with the exact byte count on hover or in details.

## Experience

- The tool is the first thing on the page; explanation comes after.
- Works at 360px and on a 2–3 GB Android phone; a 12 MP photo finishes in under ~3 s there.
- Keyboard reachable, visible focus, WCAG AA contrast, 44px tap targets, in light and dark.
- Errors say what happened and what to do next; nothing fails silently.
- Professional and restrained: no cartoon illustrations, emoji, heavy gradients or bouncy motion.
