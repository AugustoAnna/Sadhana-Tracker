# Sadhana Tracker — Design System (Draft)

> Extracted from screenshot references. Awaiting Figma node IDs for final values.

## Colours

| Token | Value | Usage |
|---|---|---|
| `--bg-cream` | `#FDFBF5` | Page background |
| `--bg-white` | `#FFFFFF` | Cards, modals |
| `--primary` | `#0D8A7A` | Buttons, toggles, links |
| `--primary-dark` | `#0A6B5E` | Button pressed |
| `--header-dark` | `#1A2B2B` | Practice home header |
| `--text-primary` | `#1A1A1A` | Headings, body |
| `--text-secondary` | `#6B6B6B` | Labels, metadata |
| `--text-muted` | `#9B9B9B` | Disabled, placeholders |
| `--journey-accent` | `#C4783A` | Current level, progress |
| `--border` | `#E5E0D5` | Dividers, inputs |
| `--error` | `#D32F2F` | Delete actions |
| `--player-bg` | `#5C4A2A` | Practice player |
| `--morning-gradient` | `#FFF0E0 → #FFFFFF` | Time-of-day cards |
| `--afternoon-gradient` | `#FFF8E0 → #FFFFFF` | |
| `--evening-gradient` | `#F5E8F0 → #FFFFFF` | |
| `--night-gradient` | `#E8F0F8 → #FFFFFF` | |

## Heat map (R5)

Bands 0–12 as specified in feature spec. Empty = white + centre dot.

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Screen title (serif) | Fraunces | 600 | 28px |
| Section title | DM Sans | 700 | 18px |
| Body | DM Sans | 400 | 16px |
| Label (caps) | DM Sans | 600 | 11px, letter-spacing 0.08em |
| Stat number | DM Sans | 700 | 24px |
| Timer | DM Sans | 500 | 32px |

## Spacing scale

4, 8, 12, 16, 20, 24, 32, 48, 64 (px)

## Radii

| Token | Value |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 24px |
| `--radius-full` | 9999px |

## Component inventory

| Component | States |
|---|---|
| `Button` | primary, secondary, text, disabled |
| `TextInput` | empty, focused, filled, disabled |
| `Checkbox` | unchecked, checked (animated), disabled |
| `PlusButton` | default, with total |
| `PlayButton` | default, disabled |
| `Toggle` | on, off |
| `StickyAction` | enabled, disabled, with count |
| `BottomSheet` | open, closed |
| `TimePicker` | scrolling wheel |
| `MinutePicker` | 5–180 in steps of 5 |
| `Modal` | confirm, info |
| `Toast` | success (edit save only) |
| `ProgressRing` | 0–100% |
| `ProgressBar` | journey bar |
| `PracticeCard` | default, completed, with-instance-label |
| `JourneyRow` | level 0–16, animating |
| `HeatMapCell` | bands 0–12 |
| `WeekStrip` | 7 cells |
| `SessionCard` | 2–9+ practice grid |
| `PlantVisual` | level 0–16 placeholder SVG |
| `PhaseHeader` | Roots, locked phase |

## Screens awaiting Figma

All 15 screens flagged `awaiting-design` until node IDs supplied.
