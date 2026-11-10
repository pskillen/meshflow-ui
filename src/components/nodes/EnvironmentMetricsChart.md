# EnvironmentMetricsChart

## Purpose

Environment readings for one node over the page's shared range: temperature, humidity, pressure and the rest, one chart card each.

## Props

`internalId`, `range: StatsRange`.

## Behaviour

- Fetches environment metrics bucketed to match the range (end one hour past `window.end`) and renders a [`MetricTrendCard`](./MetricTrendCard.md) for each reading that has any value in the range, in a fixed order (temperature and humidity first). It renders cards only; the parent grid places them.
- Each card has a fitted y axis and the latest value as the headline with its unit. Colour is the `--chart-1` token.
- Shown only when the node has environment readings (`NodeStatsSection` checks `latest_environment_metrics`); if none fall in the range, one empty card says so.
- Wind direction is not charted (an angle has no useful mean).

## Wiring

`NodeStatsSection`.

## Related

[`MetricTrendCard`](./MetricTrendCard.md), `src/lib/node-metric-series.ts`.
