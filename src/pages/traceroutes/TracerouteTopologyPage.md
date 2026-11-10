# TracerouteTopologyPage

## Purpose

The traceroute mesh drawn as a graph (nodes and weighted edges) rather than on a map: dot size is centrality, fill is degree, edges are packet volume (`/traceroutes/map/topology/heat`) or link quality (`/traceroutes/map/topology/snr`). It answers "which nodes are the backbone" where [`TracerouteHeatmapPage`](./TracerouteHeatmapPage.md) answers "where is the traffic".

## Inputs (URL)

Same as the heatmap page: `?range=`, `?since=` (custom start, UTC, not in the future), `?source=`, `?strategy=`, `?selected=`. They are carried when switching between the two pages with the view select or the "Map view" link.

## Behaviour

- Toolbar is [`TracerouteHeatmapChrome`](../../components/traceroutes/TracerouteHeatmapChrome.md), identical to the heatmap page.
- Same data request as the heatmap (`useHeatmapEdges`, `triggered_at_after` from the custom date or the preset window start, no end bound); the graph is `TracerouteTopologyGraph`.
- Selecting a node opens a side panel (`topology-node-panel`) with its details and a link back to the map view; the selection lives in `?selected=`.
- A backbone/relay table sits under the graph. Loading and error states replace the graph.
- 90d is the heaviest window.

## Wiring

Routes `/traceroutes/map/topology/heat` and `/traceroutes/map/topology/snr` (`/traceroutes/topology` redirects).

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapSinceControl`](../../components/traceroutes/MapSinceControl.md), [`StatsRangeBar`](../../components/stats/StatsRangeBar.md).
