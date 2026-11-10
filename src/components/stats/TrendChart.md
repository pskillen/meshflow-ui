# TrendChart

## Purpose

One line or bar chart over a stats range window. Online nodes is a line (a point is a count at a moment); New nodes and Packet volume are bars (a bar is a total over a bucket). It has no dashboard knowledge, so node pages and traceroute statistics reuse it. Wrap it in [`ChartCard`](ChartCard.md).

## Props

- `kind: 'line' | 'bar'`
- `rows: TrendRow[]` – `{ timestamp (bucket start, ms), <seriesKey>: number, partial?: boolean }`. Missing buckets and values are fine.
- `series: { key, label, color }[]` – colours are chart tokens (`hsl(var(--chart-1))`), by protocol: Meshtastic `--chart-1`, MeshCore `--chart-4`.
- `window: { start, end }` – from `useStatsRange().window`. Fixes the x-axis.
- `bucket: 'hourly' | '6h' | 'daily'` – from `useStatsRange().bucket`.
- `stacked?` (bars, default true), `dots?` (lines: a dot on every point, for sparse daily data such as firmware), `legend?` (default true; false where the card already lists the series), `syncId?`, `height?` (default 190), `label?` (the title and range: "Online nodes, last 7 days"), `headline?` (the card's headline text), `className?`.

Helpers in `src/lib/stats-trend.ts`: `markPartialBuckets(rows, window, bucket)` sets `partial` from the range window and each row's `samples`; `buildBucketGrid`, `densifyTrendRows`, `evenTrendTicks`, `describeTrend`, `splitPartialLine`, `formatTrendTick`, `formatTrendLabel`.

## Behaviour

- Rows are laid on the full UTC bucket grid between `window.start` and `window.end`, so every chart with the same window has the same x positions. Charts sharing a `syncId` share hover.
- The y-axis runs from 0 to a `niceAxisMax` top (stacked bars fit the stack total).
- Partial buckets (the one in progress, or a first bucket with fewer samples than a whole one) are drawn as faded dashed bars, or a dashed continuation of the line, and the tooltip adds "partial bucket".
- X labels and tooltips are in UTC, matching the buckets. Ticks are every Nth bucket from the first (about six in all), so the gaps are even.

## Accessibility (the pattern every chart in phases 11-16 reuses)

A chart is an SVG, so a screen reader needs the data said in words:

- **Name from the data.** `role="img"` with an `aria-label` built by `describeTrend`: `label` (title and range), "One value per <bucket>", the `headline`, "Latest, <bucket>: <series> <value>", and "The last bucket is in progress." when the final bucket is partial. Never a bare "Chart".
- **Table of the values.** An `sr-only` `<table>` follows the chart: one row per bucket on the grid (gaps read "no data", partial buckets say "(partial)"), one column per series. The chart itself is `role="img"`, so its children are not read; the table is how a screen reader gets every value.
- **Headline by description.** Inside a [`ChartCard`](ChartCard.md) the chart gets `aria-describedby` pointing at the card's headline (through `ChartCardContext`), so the "avg 88" is read with the chart.
- **Card titles are headings.** `ChartCard` renders the title as an `h3` (under the section's `h2`) so users can jump between charts.

A new chart passes `label` and `headline` and gets all of this; it does not write its own label.

## Wiring

`MeshStatsSection` builds rows from stats snapshots and renders three of these.

## Related

- [`ChartCard`](ChartCard.md), [`MeshStatsSection`](../MeshStatsSection.md), `src/hooks/useStatsRange.md`
