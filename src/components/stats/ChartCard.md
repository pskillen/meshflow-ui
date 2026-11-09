# ChartCard

## Purpose

The frame every stats chart sits in: title, a headline number for the range, a pill saying in plain words what one point or bar is, an optional slot for chart-only controls, the chart itself, and small print. It knows nothing about the data, so dashboards, node pages and traceroute statistics all use it. Pair it with [`TrendChart`](TrendChart.md).

## Props

- `title: string`
- `headline?: ReactNode` – the one number for the range ("avg 88", "16,867"), right of the title.
- `measure?: ReactNode` – pill text: "Packets per 6-hour bucket", "Each point: nodes heard in the 2h before it".
- `actions?: ReactNode` – controls for this chart only (the Packet volume Total / By type toggle).
- `note?: ReactNode` – small print under the chart (partial-bucket and snapshot-lag notes).
- `children` – the chart.
- `className?`, `data-testid?` (also sets `<id>-headline` and `<id>-measure`).

## Behaviour

Presentational. Numbers use tabular figures; the caller formats them. The card can shrink inside a grid (`min-w-0`).

## Wiring

Used by `MeshStatsSection` for Online nodes, New nodes and Packet volume.

## Related

- [`TrendChart`](TrendChart.md), [`MeshStatsSection`](../MeshStatsSection.md), [`StatsRangeBar`](StatsRangeBar.md)
