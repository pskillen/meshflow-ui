# TracerouteStatsSection

## Purpose

The body of the Traceroute statistics page: four headline tiles, one Outcomes chart, and comparable bars for strategy, feeder, targets and trigger. It shows what the API's traceroute stats endpoint returns for a window; it does not choose the window or the feeder.

## Props

- `sourceNodeId?: number | null` – limit stats to traceroutes sent from this managed node (the page's feeder filter, `?source_node=`).
- `range: Pick<StatsRange, 'key' | 'longLabel' | 'window'>` – the page's `useStatsRange({ area: 'traceroutes' })` result. `window.start` is sent as `triggered_at_after` (stable within the hour, so the query key does not churn); `key` decides hourly or daily data; `longLabel` names the chart ("Outcomes, last 7 days").

## Behaviour

- **Tiles:** Success rate (completed ÷ finished), Runs (completed + failed), Targets probed (with how many were reached), Feeders running (sent at least one). Placeholders while loading.
- **Outcomes** ([`ChartCard`](../stats/ChartCard.md) + [`TrendChart`](../stats/TrendChart.md)): stacked completed and failed bars by trigger time. At 24h it requests `bucket=1h` and draws one bar per UTC hour (25, the current hour in progress). At 7d, 30d and 90d the API only has UTC days, so the bars are days (7d is daily here, not 6-hourly); the first day is faded when the range starts mid-day and the current day always is. If a 24h response has no `bucket_start` (API without hourly support) the chart falls back to days and a note says so. Row building lives in `src/lib/traceroute-stats-trend.ts`.
- **Bars** ([`BarList`](BarList.md)): By strategy and By feeder (top 6) show success rate and finished runs; Most and Least reliable targets (5 or more attempts, 5 shown, each a link to that target's traceroute history); By trigger shows share of runs. Every bar card has **Show table / Hide table**, which reveals the full table: strategy (total, completed, failed, pending, in flight, success), feeders with node IDs, targets with node IDs (up to 25), trigger counts. The old pies' information is in these bars and tables.
- Strategy figures leave out external mesh reports (as the old chart did); runs with no strategy are Legacy.
- The API has no end bound, so presets that end at the top of the hour still include the current partial hour.
- Layout: single column on phones, two columns from `md`. Tables scroll inside their own box, so the page never scrolls sideways.

## Wiring

Rendered by `src/pages/traceroutes/TracerouteStatsPage.tsx`, which owns the range and the feeder filter, both in a [`StatsRangeBar`](../stats/StatsRangeBar.md). The `traceroutes` range area is shared with the four traceroute maps (`useMapRange`). Data: `useTracerouteStats` (`src/hooks/api/useTraceroutes.ts`).

## Related

- [`BarList`](BarList.md), [`ChartCard`](../stats/ChartCard.md), [`TrendChart`](../stats/TrendChart.md), [`StatTile`](../stats/StatTile.md), [`useStatsRange`](../../hooks/useStatsRange.md).
