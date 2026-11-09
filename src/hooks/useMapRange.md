# useMapRange

## Purpose

The time range for the traceroute map pages (heatmap, topology, coverage by node, constellation coverage). It wraps [`useStatsRange`](./useStatsRange.md) in the shared `traceroutes` area and adds an optional custom start date for the heatmap and topology pages.

## Inputs

- `allowCustom` (default false): honour `?since=YYYY-MM-DD`.

## Returns

`range` (the `useStatsRange` result), `barValue` (preset to highlight, `null` while custom is active), `since`, `triggeredAtAfter`, `setPreset`, `setSince`.

## Behaviour

- Presets are 24h, 7d, 30d, 90d (default 7d) in `?range=`. `triggeredAtAfter` is the fixed window start from `statsRangeWindow` (N x 24h before the top of the hour), stable for an hour, not a calendar `subDays`.
- A valid `?since=` (local midnight) overrides the preset and is open-ended: the map endpoints have no end bound.
- Choosing a preset removes `since` (via `useStatsRange`'s `clearOnChange`).
- Only the start of the window is sent to the API, as on the traceroute stats page.

## Wiring

`TracerouteHeatmapPage`, `TracerouteTopologyPage` (`allowCustom`), `FeederCoveragePage`, `ConstellationCoveragePage`.

## Related

[`StatsRangeBar`](../components/stats/StatsRangeBar.md), [`MapSinceControl`](../components/traceroutes/MapSinceControl.md).
