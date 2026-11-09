# TrendChart

## Purpose

One line or bar chart over a stats range window. Online nodes is a line (a point is a count at a moment); New nodes and Packet volume are bars (a bar is a total over a bucket). It has no dashboard knowledge, so node pages and traceroute statistics reuse it. Wrap it in [`ChartCard`](ChartCard.md).

## Props

- `kind: 'line' | 'bar'`
- `rows: TrendRow[]` – `{ timestamp (bucket start, ms), <seriesKey>: number, partial?: boolean }`. Missing buckets and values are fine.
- `series: { key, label, color }[]` – colours are chart tokens (`hsl(var(--chart-1))`), by protocol: Meshtastic `--chart-1`, MeshCore `--chart-4`.
- `window: { start, end }` – from `useStatsRange().window`. Fixes the x-axis.
- `bucket: 'hourly' | '6h' | 'daily'` – from `useStatsRange().bucket`.
- `stacked?` (bars, default true), `syncId?`, `height?` (default 190), `label?` (aria), `className?`.

Helpers in `src/lib/stats-trend.ts`: `markPartialBuckets(rows, window, bucket)` sets `partial` from the range window and each row's `samples`; `buildBucketGrid`, `densifyTrendRows`, `splitPartialLine`, `formatTrendTick`, `formatTrendLabel`.

## Behaviour

- Rows are laid on the full UTC bucket grid between `window.start` and `window.end`, so every chart with the same window has the same x positions. Charts sharing a `syncId` share hover.
- The y-axis runs from 0 to a `niceAxisMax` top (stacked bars fit the stack total).
- Partial buckets (the one in progress, or a first bucket with fewer samples than a whole one) are drawn as faded dashed bars, or a dashed continuation of the line, and the tooltip adds "partial bucket".
- X labels and tooltips are in UTC, matching the buckets.

## Wiring

`MeshStatsSection` builds rows from stats snapshots and renders three of these.

## Related

- [`ChartCard`](ChartCard.md), [`MeshStatsSection`](../MeshStatsSection.md), `src/hooks/useStatsRange.md`
