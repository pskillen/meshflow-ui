# PowerMetricsChart

## Purpose

Power-channel readings for one node over the page's shared range, as two cards: voltage and current (volts and amps never share an axis).

## Props

`internalId`, `range: StatsRange`.

## Behaviour

- Fetches power metrics bucketed to match the range (end one hour past `window.end`). One line per channel that has data; channels take the chart tokens `--chart-1` to `--chart-5`, then the same colours dashed.
- Renders cards only; the parent grid places them. Shown only when the node has power readings (`NodeStatsSection` checks `latest_power_metrics`); if none fall in the range, one empty card says so.

## Wiring

`NodeStatsSection`.

## Related

[`MetricTrendCard`](./MetricTrendCard.md), `src/lib/node-metric-series.ts`.
