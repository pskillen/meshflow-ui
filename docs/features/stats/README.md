# Stats

**Status:** Done · **Tracking:** https://github.com/pskillen/meshflow-ui/issues/407

## Problem

Stats appear on the dashboards (Home, Meshtastic, MeshCore), the node pages, the node lists and the traceroute screens. They used to disagree: different presets, different defaults, "All time" in some places and not others, and chart buckets that did not line up with the API's rollups. The stats delivery gave all of them one range model.

Charts now draw on the same UTC bucket grid the API rolls up on, so a bar in the UI is a bar in the API. The API side is described in the counterpart doc: https://github.com/pskillen/meshflow-api/blob/main/docs/features/packet-stats/README.md

## Documentation map

The behaviour lives in sidecar docs next to the code. This page is the way in; follow the links for detail.

| Topic                                    | Doc                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presets, default, resolution, UTC, areas | [`useStatsRange`](../../../src/hooks/useStatsRange.md)                                                                                                                                                                                                                                                                                                                                                                                    |
| Range control                            | [`StatsRangeBar`](../../../src/components/stats/StatsRangeBar.md)                                                                                                                                                                                                                                                                                                                                                                         |
| Chart frame and chart                    | [`ChartCard`](../../../src/components/stats/ChartCard.md), [`TrendChart`](../../../src/components/stats/TrendChart.md)                                                                                                                                                                                                                                                                                                                    |
| Dashboard charts                         | [`MeshStatsSection`](../../../src/components/MeshStatsSection.md)                                                                                                                                                                                                                                                                                                                                                                         |
| Live counts                              | [`RightNowBand`](../../../src/components/stats/RightNowBand.md)                                                                                                                                                                                                                                                                                                                                                                           |
| Firmware split and trend, phone layout   | [`FirmwareAdoptionCard`](../../../src/components/FirmwareAdoptionCard.md), [`Dashboard`](../../../src/pages/Dashboard.md)                                                                                                                                                                                                                                                                                                                 |
| Battery reading                          | [`battery`](../../../src/lib/battery.md)                                                                                                                                                                                                                                                                                                                                                                                                  |
| Node lists                               | [Node lists](node-lists.md), [`ProtocolNodesPage`](../../../src/pages/protocol/ProtocolNodesPage.md), [`NodesTable`](../../../src/components/nodes/NodesTable.md), [`MapMarkerLegend`](../../../src/components/nodes/MapMarkerLegend.md), [`NodesAndConstellationsMap`](../../../src/components/nodes/NodesAndConstellationsMap.md), [`NodeSearch`](../../../src/components/NodeSearch.md), [API hooks](../../../src/hooks/api/README.md) |
| Traceroute maps                          | [`useMapRange`](../../../src/hooks/useMapRange.md), [`TracerouteHeatmapPage`](../../../src/pages/traceroutes/TracerouteHeatmapPage.md), [`TracerouteTopologyPage`](../../../src/pages/traceroutes/TracerouteTopologyPage.md), [`FeederCoveragePage`](../../../src/pages/traceroutes/FeederCoveragePage.md), [`ConstellationCoveragePage`](../../../src/pages/traceroutes/ConstellationCoveragePage.md)                                    |
| Older fixed-length keys                  | Comment in `src/lib/time-range.ts`                                                                                                                                                                                                                                                                                                                                                                                                        |

## Concepts

- **Presets.** 24h, 7d, 30d and 90d everywhere, default 7d. There is no "All". Online (2h) is offered on node lists only.
- **UTC bucket grid.** 24h is hourly, 7d is 6-hourly (00/06/12/18 UTC), and 30d and 90d are UTC days. The window start is floored to a bucket boundary and the end is the current UTC hour, so the last bucket of 7d, 30d and 90d is still in progress; it is drawn faded or dashed. A preset can therefore show one bucket more than its label (90d draws 91 days).
- **Range memory.** The range carries within an area only. The areas are `dashboards` (Home, Meshtastic, MeshCore), `traceroutes` (the stats page and the four traceroute maps) and `node-lists`. Node pages carry the range only through the URL, between tabs. The slide-over keeps its range local. A valid `?range=` always wins.
- **Older pickers.** `Nd` keys in `src/lib/time-range.ts` are fixed N×24h blocks (`2d` is 48h hourly, `7d` is 168h at 6h buckets). `niceAxisMax` gives 1/2/5 ticks.
- **Stat classes.** Live count (now), gauge (latest value), flow (rate over the range), events in range (counted in the window). See [`useStatsRange`](../../../src/hooks/useStatsRange.md).
- **Previous-period change.** The Online nodes, New nodes and Packet volume headlines show the change against the previous period of the same length ("+12% vs previous 7d"), in a neutral colour. It compares whole buckets on the UTC grid, leaving out the bucket in progress on both sides, and gauges average while flows sum. It reads "No comparison" when either side has under 90% of its hourly snapshots, the previous total is 0, or a page was truncated. The previous window is one non-blocking request per stat type. Right now and firmware adoption have no delta: they are live counts with their own windows.
- **Battery reading.** 101 reads "Powered", 0 is a real reading, and a missing reading is a dash.

## Decisions

Each was decided in https://github.com/pskillen/meshflow-ui/issues/407.

- Presets 24h/7d/30d/90d, default 7d, "All" dropped.
- The range carries within an area only, through per-session storage per area, and the URL wins.
- Presets end on the hour, and Online (2h) ends at now.
- Stats windows are UTC throughout, matching the API's buckets, and the last bucket is marked in progress.
- Traceroute statistics and the four traceroute maps share one area. A custom range on the maps is "since" only, because the heatmap API has no end bound.
- Dashboard charts share `ChartCard` and `TrendChart`, and 30d/90d ask for `bucket=1d`.
- Home "Right now" shows the total with `MT n · MC n`. "All time" is not shown. There is one battery helper.
- The firmware split is the latest snapshot, labelled with its own window. The trend follows the range on a daily grid. Phones show counts and the trend only. Home puts stats above the map, and on phones the map stays collapsed and unmounted until opened. Unknown firmware is dashed, so it is never told apart by colour alone.
- Dashboard headlines show the change against the previous period; there is no previous-period line on the trend charts.

## Known gaps

- Node updates from the bot still send 0 for a missing device metric, so the battery chart keeps dropping 0 voltage, and 0 level when voltage is missing: https://github.com/pskillen/meshflow-bot/issues/170

## Links

- API counterpart: https://github.com/pskillen/meshflow-api/blob/main/docs/features/packet-stats/README.md
