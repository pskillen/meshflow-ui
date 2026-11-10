# BarList

## Purpose

Comparable horizontal bars in place of pie slices: a label, a bar on a shared 0-100 scale, and a figure ("82% · 40"). Used by the traceroute statistics cards.

## Props

- `rows: { key, label, percent, text, href? }[]` – `percent` fills the bar (clamped 0-100); `text` is the right-hand figure; `href` makes the label a router link.
- `label: string` – accessible name of the list.
- `color?: string` – bar colour, default `hsl(var(--chart-2))`.
- `emptyMessage?: string` – shown when there are no rows.

## Behaviour

Rendered as a `ul` with one `li` per row, so a screen reader reads label and figure; the bar itself is decorative (`aria-hidden`). Labels truncate with the full text in `title`. Presentational: callers compute percent and text.

## Wiring

[`TracerouteStatsSection`](TracerouteStatsSection.md): By strategy, By feeder, Most and Least reliable targets, By trigger.

## Related

- [`TracerouteStatsSection`](TracerouteStatsSection.md), [`ChartCard`](../stats/ChartCard.md).
