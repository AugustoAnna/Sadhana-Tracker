# Sadhana Tracker — Design System

> Consumes Design System 2.0 `Semantics/*` via CSS variables in `src/index.css`.
> Values below are **D2 fallbacks** until Figma node `10783-5275` resolves live tokens.

## Colour (Semantics)

| Token | CSS / Tailwind | Value | Use |
|---|---|---|---|
| `accent/primary` | `--color-primary` | `#0D8A7A` | Primary actions, active states |
| `accent/primary-light` | `--color-primary-light` | `#2A9D9B` | Raised buttons on dark grounds |
| `surface/page` | `--color-page` / `bg-page` | `#FFFFFF` | Screen background |
| `surface/card` | `--color-card` / `bg-card` | `#F2EFE7` | Cream cards, journey row, explore |
| `surface/sunken` | `--color-sunken` | `#E9E5DA` | App home behind Practices card |
| `surface/placeholder` | `--color-placeholder` | `#E9E9E9` | Illustration placeholders |
| `text/primary` | `--color-ink` | `#1C1C1C` | Titles, practice names |
| `text/secondary` | `--color-secondary` | `#5F5F5F` | Supporting text |
| `text/muted` | `--color-muted` | `#767676` | Meta text — do not go lighter |
| `text/brass` | `--color-brass` / `.eyebrow` | `#7D6B42` | Eyebrow labels on cream |
| `ground/warm` | `--color-ground` | `#8A7132` | Player & post-practice grounds |
| `border/hairline` | `--color-hairline` | `#EEEEEE` | Row dividers |
| `border/default` | `--color-border` | `#DCDCDC` | Control outlines |
| `journey/accent` | `--color-journey` | `#C6530F` | Progress bar, ring, ticks |

Heat map bands (R5) are unchanged.

## Dark mode

`<html data-theme="dark">` swaps the Semantics values above (`src/services/theme.ts`; `index.html` sets it before first paint). Settings → Appearance picks Light, Dark or Auto, saved per device. Auto (the default) is dark from 6pm to 6am, or between the times chosen there, and whenever the device is in dark mode. `?theme=dark`, `?theme=light` or `?theme=auto` on the URL sets the same choice, for testing.

- Warm near-blacks (page `#141311`, card `#211F1B`) and off-white ink `#ECE8DF`, not pure black/white. Every text/surface pair clears WCAG AA.
- Filled teal (`bg-primary`) is unchanged so white labels read the same. Teal as text/icon uses `text-primary-text`, which brightens to `#35B5A2`.
- Journey, error and brass lighten so they still read on dark.
- Heat map keeps the same greens as light mode; only the empty-day greys darken.
- Type steps down one weight (600→500, 700→600): light text on dark reads heavier.
- New components: use tokens, not hex or Tailwind greys. For a one-off, pair it with a `dark:` variant.

## Typography (D3)

| Token | Class | Size | Weight | Use |
|---|---|---|---|---|
| display | `.text-display` | 24 | 700 | Screen titles |
| headline | `.text-headline` | 20 | 700 | Empty state, level-up, player |
| title | `.text-title` | 16 | 600 | Section headers |
| body | `.text-body` | 14 | 600 | Practice names |
| label | `.text-label` | 12.5 | 400 | Supporting lines |
| meta | `.text-meta` | 12 | 600 | Chips, stat labels |
| stat | `.text-stat` | 19 | 700 | Stat numbers |

Fonts: DM Sans (UI), Fraunces (serif — empty headline, level labels, player eyes-closed line).

## Spacing & radius (D4)

Spacing: 4, 8, 12, 16, 26. Screen padding 16. Section gap 26. Row py 12.

| Radius | Value |
|---|---|
| control | 7px |
| thumbnail | 8px |
| card / CTA | 12px |
| cream card | 14px |
| bottom sheet | 18px |
| rings | 50% |

Minimum tap target 44×44 (`min-h-11` / `w-11 h-11`). Checkbox and plus drawn at 26px inside 44px hit area.

## Open items

1. Resolve live Semantics values from Figma node `10783-5275`.
2. Practice illustration assets (47).
3. Confirm serif on level labels (currently applied).
