# TracerouteHeatmapPage

## Purpose

Geographic map of the mesh built from traceroute edges: where packets flow (`edgeMetric="packets"`, `/traceroutes/map/heat`) or how healthy the links are (`edgeMetric="snr"`, `/traceroutes/map/snr`). Use [`TracerouteTopologyPage`](./TracerouteTopologyPage.md) for the same data as a graph without geography.

## Inputs (URL)

- `?range=` 24h / 7d (default) / 30d / 90d, shared with the other traceroute pages through `useMapRange`.
- `?since=YYYY-MM-DD` custom start (UTC midnight, up to now). Overrides the preset; choosing a preset removes it. A malformed or future date is ignored.
- `?source=` source managed node (mesh id), `?strategy=` comma list of target-selection strategies, `?selected=` clicked node (dropped if it is not in the result).

## Behaviour

- Toolbar is [`TracerouteHeatmapChrome`](../../components/traceroutes/TracerouteHeatmapChrome.md): title, view select (switches heatmap/topology and packets/SNR, keeping the query string), source, strategy, then presets and Custom on the right.
- One request, `useHeatmapEdges`, with `triggered_at_after` = the custom date or the preset window start (a fixed N x 24h window, hour-aligned). There is no end bound.
- `NetworkStatsCard` (active nodes, total traceroutes, colour keys) floats over the map on desktop and sits above it on phones. A backbone/relay table follows the map.
- 90d is the longest window and the endpoint has no server cap, so it is the heaviest load.
- Loading and error states replace the map in place.

## Wiring

Routes `/traceroutes/map/heat` and `/traceroutes/map/snr` (`/traceroutes/heatmap` redirects). Data from `useHeatmapEdges`; map drawn by `TracerouteHeatmapMap`.

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapSinceControl`](../../components/traceroutes/MapSinceControl.md), [`StatsRangeBar`](../../components/stats/StatsRangeBar.md).
