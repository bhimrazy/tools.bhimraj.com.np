# Design system

Precise, calm utility software: neutral greys, one blue accent, 1px borders, small radii and a clear type
hierarchy. The figures a user must match (pixels, KB, format) and the trust signals (on-device, verified or not)
should read at a glance. No illustrations, emoji, gradients or decorative motion.

Every page, and any future channel (extension, widget), uses the semantic tokens below, never raw colours. They live
in `src/styles/global.css`: light values in `@theme`, dark values overriding the same variables.

## Theme

Dark follows `prefers-color-scheme`. A host can pin either theme with `<html data-theme="light">` or `"dark"`; keep
the two dark blocks in `global.css` identical. Utilities such as `bg-surface` and `text-muted` need no `dark:`
variants.

## Colour tokens

Ratios are WCAG contrast against the background named in the last column (text needs 4.5:1, borders that identify a
control need 3:1).

| Token               | Light                 | Dark                  | Use                                            | Contrast (light / dark)                |
| ------------------- | --------------------- | --------------------- | ---------------------------------------------- | -------------------------------------- |
| `bg`                | `#fafafa`             | `#0e0e10`             | page background                                |                                        |
| `surface`           | `#ffffff`             | `#161618`             | cards, fields, header, drop zone               |                                        |
| `subtle`            | `#f4f4f5`             | `#1e1e21`             | hover fill, preview well, neutral badge        |                                        |
| `border`            | `#e4e4e7`             | `#27272b`             | dividers, card outlines (decorative)           |                                        |
| `border-strong`     | `#8e8e96`             | `#64646d`             | field and drop-zone outlines, secondary button | 3.25 / 3.09 on surface                 |
| `text`              | `#18181b`             | `#ededef`             | body text, headings, figures                   | 16.97 / 16.49 on bg                    |
| `muted`             | `#52525b`             | `#a1a1aa`             | secondary text, labels                         | 7.41 / 7.52 on bg; 6.49 dark on subtle |
| `faint`             | `#6b6b73`             | `#8b8b94`             | placeholders, IDs, separators                  | 4.81 / 4.92 on subtle                  |
| `accent`            | `#2453c9`             | `#6f9bff`             | links, primary button, drag state              | 6.38 / 7.17 on bg                      |
| `accent-hover`      | `#1d44a8`             | `#8fb1ff`             | hover for the above                            |                                        |
| `accent-contrast`   | `#ffffff`             | `#0e0e10`             | text on `accent`                               | 6.65 / 7.17                            |
| `accent-soft`       | `#eef2fc`             | `#141c30`             | drag-over fill                                 | accent on it 5.94 / 6.30               |
| `focus`             | `#2453c9`             | `#6f9bff`             | 2px focus ring                                 | 6.38 / 7.17 on bg                      |
| `success` / `-soft` | `#16773a` / `#edf7f0` | `#4cc777` / `#0f2017` | verified, within target                        | 5.13 / 7.86 on soft                    |
| `warning` / `-soft` | `#93470a` / `#fdf5e7` | `#f0b54a` / `#251b0a` | unverified spec, hints                         | 6.16 / 9.21 on soft                    |
| `danger` / `-soft`  | `#b42318` / `#fdf1f0` | `#ff8a80` / `#2a1414` | errors, outside target                         | 5.95 / 7.61 on soft                    |

## Type, shape, space, motion

- **Fonts**: the `system-ui` stack (with Noto Devanagari/Bengali fallbacks); no web fonts, so no download and no
  third-party request. Figures use `tabular-nums` so sizes line up; `font-mono` only for IDs.
- **Scale**: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px (`xs` to `4xl`). Headings 600 with -0.015em tracking; labels
  and buttons 500. Body is 16px (fields too, so iOS doesn't zoom).
- **Radii**: `sm` 4px (badges), `md` 6px (buttons, fields, alerts), `lg` 8px (cards, drop zone, readout).
- **Shadow**: `shadow-xs` on cards and secondary buttons in light only; dark uses borders alone.
- **Spacing**: Tailwind's 4px grid. One 768px column (`max-w-3xl`); section gaps of 40px.
- **Targets**: every control is at least 44px tall, including header and footer links.
- **Focus**: 2px `focus` outline, 2px offset (0 on fields, where the border also turns `focus`).
- **Motion**: colour and border transitions only, `duration-fast` (120ms) with `ease-standard`. Under
  `prefers-reduced-motion` all transitions and animations are cut to zero.

## Components (`@layer components`)

| Class                                                      | Use                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `btn-primary` / `btn-secondary` / `btn-ghost`              | One primary per view. After a result, Download is primary and "Choose another" secondary.           |
| `field`                                                    | Text and number inputs; label above (`text-sm font-medium`), unit in `text-muted`.                  |
| `card`, `a.card`                                           | Grouped content; linked cards darken their border on hover.                                         |
| `badge` + `-success` / `-warning` / `-danger` / `-neutral` | Status. Always icon + word; `SpecBadge.astro` renders Verified / Unverified.                        |
| `readout`                                                  | `<dl>` of required or resulting figures: 2 columns on phones, one row from 640px.                   |
| `kv`                                                       | Key/value `<dl>` rows for the spec and result details.                                              |
| `dropzone`                                                 | Dashed target; `data-dragging` makes it solid accent. Files dropped anywhere on the page also work. |
| `alert` + `-danger` / `-warning`                           | Icon, bold lead-in, then what to do next. Body text stays `text`.                                   |
| `spinner`                                                  | Inline busy indicator next to the status text.                                                      |

Icons live in `src/components/icons.tsx`: 16px line icons, 1.5 stroke, `currentColor`, always `aria-hidden` beside
a text label.

## Do and don't

| Do                                                        | Don't                                                |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Put the exact requirement (px, KB, format) above the tool | Hide figures in small muted text                     |
| Pair every status colour with a word and an icon          | Use colour alone for verified, success or error      |
| Say where the file goes ("Processed on this device")      | Make privacy claims that aren't true today           |
| Use tokens (`text-muted`, `border-border`)                | Use raw hex, `dark:` variants or new one-off colours |
| Keep motion to colour changes                             | Add bounce, scale or entrance animations             |

## Constraints

The CSP is `style-src 'self'`: no `style=""` attributes and no inline `<style>` or `<script>` (`bun run check:csp`
fails the build). A shape that depends on data, such as the drop zone's aspect-ratio outline, uses an SVG `viewBox`.
