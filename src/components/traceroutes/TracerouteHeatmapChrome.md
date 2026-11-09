# TracerouteHeatmapChrome

## Purpose

The toolbar above the traceroute heatmap and topology pages, plus `NetworkStatsCard`. It is a `StatsRangeBar` (title on the left, filters in the slot, range presets on the right).

## Props

Range: `rangeValue` (preset key, or null while a custom date is active), `rangeOptions`, `onRangeChange`, `rangeExtras` (the custom control). Filters: `viewMode`, `edgeMetric`, `searchSuffix`, `strategyTokens`, `sourceMeshId`, `managedNodes`, `hasGeoFilters`, `onUpdateParams`.

## Behaviour

- Presets 24h / 7d / 30d / 90d (default 7d), from `useMapRange`; the range is in `?range=` and a custom start date in `?since=`.
- The mesh-view select navigates between heatmap and topology, carrying the query string (so range and filters survive).
- Source feeder and strategy filters write `?source=` / `?strategy=`.
- The bar is not sticky here: the map needs the height.

## Wiring

`TracerouteHeatmapPage`, `TracerouteTopologyPage`.

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapSinceControl`](./MapSinceControl.md), [`StatsRangeBar`](../stats/StatsRangeBar.md).
