# Design system

Precise, calm utility software: neutral greys, one blue accent, 1px borders, small radii and a
clear type hierarchy. No illustrations, emoji, gradients or decorative motion. Every page and any
future channel uses the semantic tokens below, not raw colours.

## Colour tokens (`src/styles/global.css` `@theme`)

| Token                                 | Light     | Dark      | Use                                           |
| ------------------------------------- | --------- | --------- | --------------------------------------------- |
| `bg`                                  | `#fafafa` | `#0b0b0c` | page background                               |
| `surface`                             | `#ffffff` | `#141416` | cards, inputs, header                         |
| `subtle`                              | `#f4f4f5` | `#1c1c1f` | hover fill, placeholders, neutral badge       |
| `border`                              | `#e4e4e7` | `#27272a` | 1px dividers and card borders                 |
| `border-strong`                       | `#d4d4d8` | `#3a3a40` | inputs, drop zone, hover border               |
| `text`                                | `#18181b` | `#f4f4f5` | body text and headings                        |
| `muted`                               | `#52525b` | `#a1a1aa` | secondary text (≥ 4.5:1 on bg and surface)    |
| `accent` (`-hover`, `-fg`, `-subtle`) | `#2453c9` | `#7c9cf5` | links, primary button, focus ring, drag state |
| `success` / `-subtle`                 | `#15803d` | `#4ade80` | within target, verified                       |
| `warning` / `-subtle`                 | `#a14a00` | `#fbbf24` | unverified spec                               |
| `danger` / `-subtle`                  | `#b91c1c` | `#f87171` | errors, over the limit                        |

Dark mode follows `prefers-color-scheme` by overriding the same variables, so utilities like
`bg-surface` and `text-muted` need no `dark:` variants.

## Type, shape, space

- **Fonts**: `system-ui` stack (with Noto Devanagari/Bengali fallbacks) and `ui-monospace` for figures
  such as pixel sizes, KB and bytes. No web fonts, so nothing to download and no third-party request.
- **Scale**: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px (`xs` to `4xl`). Use 600 weight with slight
  negative tracking for headings, and 500 weight for labels and buttons.
- **Radii**: `sm` 4px (badges, thumbnails), `md` 6px (buttons, fields), `lg` 8px (cards, drop zone).
- **Spacing**: Tailwind's 4px grid. Content is a single 768px column (`max-w-3xl`). Tap targets are
  at least 44px.
- **Focus**: 2px `accent` outline with a 2px offset on every interactive element.
- **Motion**: colour transitions of 120ms or less only.

## Components (`@layer components`)

`btn-primary`, `btn-secondary`, `field`, `card` (and `a.card` hover), `badge` plus `badge-success`,
`badge-warning`, `badge-danger` and `badge-neutral`, and `kv` (key/value `<dl>` rows).

## Constraints

The CSP is `style-src 'self'`, so there are no `style=""` attributes and no inline `<style>`. A shape
that depends on data, such as the drop zone's aspect-ratio outline, uses an SVG `viewBox`.
