# TracerouteStatsSection

## Purpose

The charts and tables on the Traceroute statistics page: sources, strategy mix, success/failure, success over time, runs by strategy, top and least successful targets, by-source table. It shows what the API's traceroute stats endpoint returns for a window; it does not choose the window.

## Props

- `sourceNodeId?: number | null` – limit stats to traceroutes sent from this managed node (the page's `?source_node=`).
- `triggeredAtAfter: Date` – start of the window, sent as `triggered_at_after`. Comes from `useStatsRange().window.start`, so it is stable within the hour and the query key does not churn.
- `rangeLabel: string` – wording for chart titles, from `useStatsRange().longLabel` ("last 7 days").

## Behaviour

- Fetches with `useTracerouteStats({ triggeredAtAfter, sourceNodeId })`; each card shows its own loading and "No data" states.
- The API has no end bound, so presets that end at the top of the hour still include the current partial hour.
- Pies group beyond the top 7 sources into "Other". Targets need at least 5 finished attempts to be ranked.

## Wiring

Rendered by `src/pages/traceroutes/TracerouteStatsPage.tsx`, which owns the range (`useStatsRange({ area: 'traceroutes' })`, URL `?range=`) and the source filter, both in a [`StatsRangeBar`](../stats/StatsRangeBar.md). The section has no selector of its own. Restyling is phase 16 of the stats-ux delivery.

## Related

- [`useStatsRange`](../../hooks/useStatsRange.md), [`StatsRangeBar`](../stats/StatsRangeBar.md).
