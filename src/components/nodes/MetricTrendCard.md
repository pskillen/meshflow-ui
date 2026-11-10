# MetricTrendCard

## Purpose

A node metric chart in one piece: a [`ChartCard`](../stats/ChartCard.md) around a line [`TrendChart`](../stats/TrendChart.md) on the page's shared range window. The battery, channel and air, environment and power charts all use it, so they share the title row, the headline, the measure pill, the x positions and the hover.

## Props

`title`, `headline?` (the latest value: "3.87 V", "Powered"), `measure` (what a point is: unit and bucket), `range: StatsRange`, `rows`, `series`, `yRange?`, `formatValue?`, `legend?`, `note?`, `actions?`, `empty?`, `data-testid?`. `rows` and `series` are the `TrendChart` ones.

## Behaviour

- Always a line chart, with the sync id `node-metrics`, so every metric card on a page shares hover.
- The small print adds "Dashed: the bucket in progress." when the last bucket is partial and, for hourly and 6-hour buckets, the time of the latest point.
- `empty` replaces the chart (and the headline) with a message when there is nothing to plot.

## Wiring

[`BatteryChartShadcn`](../BatteryChartShadcn.md), [`ChannelAirChart`](./ChannelAirChart.md), [`EnvironmentMetricsChart`](./EnvironmentMetricsChart.md), [`PowerMetricsChart`](./PowerMetricsChart.md). Row building is in `src/lib/node-metric-series.ts`.

## Related

[`ChartCard`](../stats/ChartCard.md), [`TrendChart`](../stats/TrendChart.md), [`NodeStatsSection`](./NodeDetailContent.md).
