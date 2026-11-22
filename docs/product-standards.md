# Product standards

Hard checks for anything user-facing. An owner correction that isn't here yet becomes a new line.
A **tool page** is any page that accepts a file, including every preset page.

## Privacy

- No file content, file name or derived data leaves the device. Tool pages make no cross-origin request; the CSP
  header and the build's CSP check enforce it.
- No third-party scripts, fonts, analytics or ads on tool pages.
- Output files carry no EXIF, GPS or thumbnail data from the input.
- Every claim on the site is true today and can be checked by a visitor. "Works offline" appears only once a service
  worker makes airplane mode work.

## Size rules

- Every form page shows each size rule's source, and either "Checked <date>" or a visible "Not checked yet" badge, plus
  a "Report a different rule" link.
- "Checked" means every figure was read on an official source on that date.
- The result shows the output's actual pixel size, format and size next to the size rule, with a clear pass or fail. A
  file that misses the size rule is never presented as done.
- Nothing is cropped silently: signatures and scans are fitted onto the background colour; photos crop only inside a
  frame the user can see and move.
- Sizes are shown the way the portal states them (KB); the exact byte count is in the result details.

## Experience

- The tool is the first thing on the page; explanation comes after.
- Works at 360px with no horizontal scroll, in light and dark.
- A 12 MP photo finishes in under 3 s in Chrome with 4× CPU throttling; `packages/image` PRs state the measured time.
- Pages without a tool ship no JavaScript; a tool page ships at most 50 KB gzip before a file is chosen.
- Keyboard reachable, visible focus, WCAG AA contrast, 44px tap targets.
- Errors say what happened and what to do next; nothing fails silently.
- Copy is plain English a non-native reader follows.
- Professional and restrained, per `apps/web/DESIGN.md`: no illustrations, emoji, gradients or decorative motion.

## Search

- Every page has a unique title and description, one canonical URL, and is in the sitemap.
- Every form page is tied to distinct, cited size rules; no page exists only to target a keyword.
