# Design system

Graphite and calm. Every tool ends the same way: the saved file, its real size, and proof that it
fits the form's size rule. One sky-blue dot means "your file", and nothing else uses sky.

## Where the theme lives

Everything visual comes from **one block** at the top of `src/styles/global.css`, between
`THEME` and `end of THEME`. Nothing else in the app defines a colour, font, radius or shadow.

1. **Layer 1, raw palette.** Tailwind v4 steps as plain variables (`--neutral-900`, `--sky-600`).
   Only layer 2 may point at them.
2. **Layer 2, semantic tokens.** `@theme { --color-paper: var(--neutral-100); … }`, once for light,
   then the same names for dark. `--color-*: initial` removes Tailwind's default palette, so only
   these names exist as utilities: `bg-paper`, `text-ink`, `border-line-strong`, `bg-band`.
3. **shadcn names.** `--background`, `--primary`, `--muted` and the rest are aliases of layer 2
   (`--primary: var(--color-accent)`), so shadcn components take the brand untouched. Never give
   them a colour of their own.

Dark mode follows `prefers-color-scheme`; `<html data-theme="dark|light">` overrides it. The
`dark:` variant follows the same rule, but components rarely need it: the tokens change instead.

**To recolour:** point layer-2 tokens at other raw steps in both the light and the dark block, then
check every text pair still reaches 4.5:1 and every border, glyph and gauge part 3:1.

### Tokens

| Token                                 | Light          | Dark        | Use                                                        |
| ------------------------------------- | -------------- | ----------- | ---------------------------------------------------------- |
| `paper`                               | neutral-100    | neutral-950 | page background                                            |
| `surface` (shadcn `card`, `popover`)  | white          | neutral-900 | cards, fields, header                                      |
| `sunk` (shadcn `muted`)               | neutral-200    | neutral-800 | inset notes, the not-checked note, hover fill              |
| `ink`                                 | neutral-950    | neutral-100 | text, the ring of the mark                                 |
| `ink-2`                               | neutral-700    | neutral-300 | ledes, labels                                              |
| `muted-foreground`                    | neutral-600    | neutral-400 | help text, captions (the system's `color-muted`)           |
| `line` (shadcn `border`)              | neutral-200    | neutral-800 | hairlines only, never a control's only edge                |
| `line-strong` (shadcn `input`)        | neutral-500    | neutral-500 | control borders                                            |
| `accent` (shadcn `primary`)           | neutral-900    | neutral-100 | the main button, once per view                             |
| `accent-ink`, `focus` (shadcn `ring`) | neutral-900    | neutral-100 | links, the 2px focus outline                               |
| `signal`, `signal-bright`             | sky-600/400    | sky-400     | the logo dot, the gauge marker, the Fits dot. Nothing else |
| `band`, `on-band`, `on-band-muted`    | neutral-900    | neutral-800 | footer band, result slab, home tool panel (`.on-band`)     |
| `status-bad` (shadcn `destructive`)   | fuchsia-700    | fuchsia-300 | doesn't fit, can't open. Magenta, never red                |
| `status-warn`, `status-warn-icon`     | ink, amber-500 | amber-400   | not-checked glyph only                                     |
| `rail-*`                              |                |             | the fit gauge                                              |

Two names differ from the design system because shadcn already uses them: the system's
`color-muted` (help text) is `muted-foreground` here, and shadcn's `muted` is the `sunk` fill.

## Type

One family, **Onest**, self-hosted from `@fontsource-variable/onest` (no third-party request).
Devanagari and Bengali runs use **Noto Sans Devanagari** and **Noto Sans Bengali**
(`font-deva`, `font-beng` or the `.deva` / `.beng` classes), imported only by pages that print
them (home and form pages); the browser fetches a script's file only when that script appears.
Set `lang` on every such run.

Styles: `.t-hero` (home headline only), `.t-h1`, `.t-h2`, `.t-h3`; body 16px; captions 13px.
Figures use `.num` (tabular, lining). Inputs stay 16px or larger so phones don't zoom.

## Shape and space

Tailwind's 4px grid. Page gutter 16px on phone, 32px from 768px; content max 1120px.
Radii: `rounded-xs` 4px, `rounded-sm` 6px, `rounded-lg` 10px (buttons, fields), `rounded-xl`
14px (cards, result slab), `rounded-full` (chips, rail). Flat by default; `shadow-e1`/`shadow-e2`
only on things that float. Buttons are 48px (`sm` 44px on phone, 40px from 640px).

## Brand pieces (`src/components/brand`)

- **Mark and lockup** (`Mark.tsx`): ring at 16,16, outer radius 15, inner 11; dot r 3.5 at
  20.5,16 (3 o'clock). Never move, centre or recolour the dot except to `signal-on-band` on the
  band. "by Bhimraj" is 55% of "Tools" on the same baseline; never drop or stack it.
- **Status glyphs** (`StatusGlyph.tsx`): fits, work, no, err, unv, idle, all drawn from the ring.
  Always pair one with a word. The Fits glyph describes a file, never a size rule.
- **Fit gauge** (`FitsGauge.tsx`): SVG with percentage attributes, so it server-renders without a
  `style` attribute. The upper limit sits at two thirds; ticks above the marker; a file that fits
  is a sky circle, one that doesn't is a magenta diamond. Figures round down on a pass and up on a
  fail (`formatFigureKb`).
- **Silhouette**: a form's upload shape at true proportion.

Favicon and app icons in `public/` are the system's Logos files (app tile, maskable tile).

## Components

shadcn/ui, Base UI variant, in `src/components/ui`, added with `bunx shadcn add <name>`.
Restyle through their `cva` variants, not per use. Button variants: `default` (main),
`outline` (secondary; `aria-pressed` makes it a selected chip), `ghost`, `destructive` (outlined
magenta), `link`, `inverse` and `outline-band` (on the band). Icons are `lucide-react`, imported
per icon (`lucide-react/icons/download`), 20px at 1.75 stroke or 16px at 2.

In `.astro` files, use `cn(buttonVariants(...))` so conflicting classes merge.

## Copy

Plain words for someone filling in a form on a phone, maybe in a second language. Buttons start
with a verb and name the thing ("Download image"). Numbers over adjectives ("Too big: 61 KB.
Your limit is 20 KB."). Say "size rule", never "spec". Privacy as checkable facts ("Your files
stay on this device"), never "secure". Never promise acceptance: "Meets the size rule we have.
Check your notice before you submit." Sentence case, no exclamation marks, no emoji.

## Constraints

- CSP `style-src 'self'`: no `style=""` in server HTML and no `<style>` elements. Islands run inside
  Base UI's `CSPProvider` with `disableStyleElements`. Controls that server-render a style
  attribute (`Select`, `Slider`) render only after hydration.
- Content pages ship no JavaScript. Tool islands load their code on first use and must work as
  server HTML until then (see `docs/adr/0005-react-islands.md`).
- 44px tap targets, visible focus, AA contrast, 360px width, light and dark.
- `prefers-reduced-motion` sets all durations to 0.
