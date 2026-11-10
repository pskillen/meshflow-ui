# ChannelAirChart

## Purpose

Channel utilisation and air-time TX for one node over the page's shared range: two percent series on one axis, in their own card. Split from the battery chart so volts and percent never mix.

## Props

`internalId`, `range: StatsRange`.

## Behaviour

- Same request as [`BatteryChartShadcn`](../BatteryChartShadcn.md) (device metrics, bucketed to match the range, end one hour past `window.end`), so it is one fetch.
- Channel use is `--chart-1` solid, air time `--chart-2` dashed. Headline is the latest channel use.
- Zero readings are kept: the device stores a missing utilisation as 0, so a bucket mean can be pulled down by missing reports. Not fixable on the client.

## Wiring

`NodeStatsSection`.

## Related

[`MetricTrendCard`](./MetricTrendCard.md), `src/lib/node-metric-series.ts`.
