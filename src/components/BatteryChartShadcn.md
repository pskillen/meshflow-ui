# BatteryChartShadcn

## Purpose

Battery history for one node over the page's shared range, as its own chart card. Volts and percent are two readings of one chart, switched by a Voltage / Percentage toggle in the card; they never share an axis, and channel use is a separate chart ([`ChannelAirChart`](./nodes/ChannelAirChart.md)).

## Props

`internalId`, `range: StatsRange` (from the page's `useStatsRange`), `defaultMode?: 'voltage' | 'percentage'` (default voltage).

## Behaviour

- Requests `useNodeMetricsSuspense(internalId, { startDate: window.start, endDate: window.end + 1h, bucket })`, where `bucket` is `metricApiBucket(range.bucket)`: 1h for 24h, 6h for 7d, 1d for 30d and 90d. The extra hour is there because `window.end` is exclusive and sits on the current hour. One request serves this chart and `ChannelAirChart` (same query key).
- The API returns one mean row per UTC bucket. If it ignores `bucket` (an older API), `bucketMetricRows` rolls raw rows up the same way.
- A bucket level of 101 (or more) is "Powered" (`describeBattery`): it is not plotted as 101%. Percentage mode says "Powered" in the headline and notes how many buckets were powered; when every bucket is powered the chart is replaced by a message.
- The device stores a missing voltage or level as 0, which bucket means can pick up. A 0 voltage is treated as missing, and a 0 level without a voltage is too; a 0 level with a voltage is a real flat battery.
- Voltage uses a fitted y axis; percentage is fixed 0 to 100. The old good/low shading bands are gone.
- Colour is the `--chart-1` token.

## Wiring

`NodeStatsSection` (Statistics tab). No other callers.

## Related

[`MetricTrendCard`](./nodes/MetricTrendCard.md), `src/lib/node-metric-series.ts`, `src/lib/battery.ts`.
