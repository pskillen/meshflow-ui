# ChartCard

## Purpose

The frame every stats chart sits in: title, a headline number for the range, a pill saying in plain words what one point or bar is, an optional slot for chart-only controls, the chart itself, and small print. It knows nothing about the data, so dashboards, node pages and traceroute statistics all use it. Pair it with [`TrendChart`](TrendChart.md).

## Props

- `title: string`
- `headline?: ReactNode` – the one number for the range ("avg 88", "16,867"), right of the title.
- `delta?: ReactNode` – change against the previous period ("+12% vs previous 7d"). A second line under the headline, inside the headline element so screen readers read it with the chart. Neutral colour: the sign and words carry the meaning. `data-testid` also sets `<id>-delta`.
- `measure?: ReactNode` – pill text: "Packets per 6-hour bucket", "Each point: nodes heard in the 2h around it".
- `actions?: ReactNode` – controls for this chart only (the Packet volume Total / By type toggle).
- `note?: ReactNode` – small print under the chart (partial-bucket and latest-point notes).
- `children` – the chart.
- `className?`, `data-testid?` (also sets `<id>-headline` and `<id>-measure`).

## Behaviour

The title is an `h3`. The headline has an id that a [`TrendChart`](TrendChart.md) inside the card points `aria-describedby` at (see its Accessibility section). A range preset names the span, but its window runs to the end of the bucket in progress and starts on a bucket boundary, so it can show a bucket more than the label says (90d draws 91 UTC days).

Presentational. Numbers use tabular figures; the caller formats them. The card can shrink inside a grid (`min-w-0`).

## Wiring

Used by `MeshStatsSection` for Online nodes, New nodes and Packet volume.

## Related

- [`TrendChart`](TrendChart.md), [`MeshStatsSection`](../MeshStatsSection.md), [`StatsRangeBar`](StatsRangeBar.md)
