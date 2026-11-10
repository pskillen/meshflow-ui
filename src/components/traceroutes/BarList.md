# BarList

## Purpose

Comparable horizontal bars in place of pie slices: a label, a bar on a shared 0-100 scale, and a figure ("82% · 40"). Used by the traceroute statistics cards.

## Props

- `rows: { key, label, percent, text, spoken, href? }[]` – `percent` fills the bar (clamped 0-100); `text` is the right-hand figure (hidden from screen readers); `spoken` is the same figures in words with units ("70% success, 700 runs"), supplied by the caller; `href` makes the label a router link.
- `label: string` – accessible name of the list.
- `color?: string` – bar colour, default `hsl(var(--chart-2))`.
- `emptyMessage?: string` – shown when there are no rows.

## Behaviour

Rendered as a `ul role="list"` (so Safari keeps list semantics under Tailwind's `list-style: none`) with one `li` per row; a screen reader reads the label and the `spoken` text; the bar itself is decorative (`aria-hidden`). Labels truncate with the full text in `title`. Presentational: callers compute percent and text.

## Wiring

[`TracerouteStatsSection`](TracerouteStatsSection.md): By strategy, By feeder, Most and Least reliable targets, By trigger.

## Related

- [`TracerouteStatsSection`](TracerouteStatsSection.md), [`ChartCard`](../stats/ChartCard.md).
