# StatsRangeBar

## Purpose

The one time-range control for stats screens: a segmented set of presets, optionally with screen-specific extras beside it. It replaces the per-card selectors. It holds no range logic; state comes from [`useStatsRange`](../../hooks/useStatsRange.md).

## Props

- `value: StatsRangeKey | null` – selected range (`range.key`); `null` while a screen's own custom range is active, so no preset looks selected.
- `options: readonly StatsRangeKey[]` – what to offer, in order (`range.options`). The default presets are `24h`, `7d`, `30d`, `90d`. **Online (2h)** appears only when `'2h'` is in `options`, which only node lists should do.
- `onChange(key)` – `range.setRange`.
- `title?` – optional heading at the start of the bar.
- `children?` – slot for screen extras placed before the range control (the source/feeder filter on traceroutes, a custom range on maps).
- `sticky?` (default true) – `position: sticky; top: 0` so the control stays in reach while scrolling.
- `className?`.

## Behaviour

- Rendered as a `radiogroup` of `radio` buttons with `aria-checked`; labels come from `STATS_RANGES` in `src/lib/stats-range.ts`.
- Keyboard: roving tabindex (only the selected radio is a tab stop); Left/Right move to and select the previous/next option, wrapping; Home/End select the first/last. Selection follows focus, as for a native radio group.
- Wraps on narrow screens; the button group scrolls horizontally rather than overflowing the page, and buttons are 32px tall on touch widths.
- Has an opaque-ish background (`bg-background/95` with blur) so content does not show through when stuck.
- Custom range is not built yet: a screen that needs it passes its own control as `children`.

## Wiring

Used by `TracerouteStatsPage` (first adopter). Later stats screens (dashboards, node pages, node lists) place it at the top of the page.

## Related

- [`useStatsRange`](../../hooks/useStatsRange.md), `src/lib/stats-range.ts`.
