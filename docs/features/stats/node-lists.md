# Node lists

Part of the [Stats](README.md) feature.

## Purpose

The Meshtastic and MeshCore node pages show a map and a searchable list of nodes heard in a range. This page records the rules and why they were chosen. The detail for each component is in its sidecar doc.

## Code anchors

- `src/pages/protocol/ProtocolNodesPage.tsx` ([doc](../../../src/pages/protocol/ProtocolNodesPage.md))
- `src/hooks/api/useProtocolNodes.ts` ([hooks doc](../../../src/hooks/api/README.md))
- `src/components/nodes/NodesTable.tsx` ([doc](../../../src/components/nodes/NodesTable.md))
- `src/components/nodes/MapMarkerLegend.tsx` ([doc](../../../src/components/nodes/MapMarkerLegend.md))
- `src/lib/mesh-protocol.ts`
- `src/components/nodes/map-constellation-colors.ts`

## Behaviour

- **Range.** Online (2h) plus the presets 24h, 7d, 30d and 90d. Online (2h) is rolling from now (five-minute tick). There is no All. The range memory area is `node-lists`. The range sets `last_heard_after` to the window start.
- **Fetching.** Up to 1000 rows per request (the API maximum) and no automatic walk. "Load more" fetches the next page. "Showing the first X of Y" appears when the server has more rows. The sidebar `NodeSearch` ([doc](../../../src/components/NodeSearch.md)) makes no list request on mount. Coverage pages use managed nodes only (the first 500).
- **Search.** Sticky between the map and the list. It filters both the map and the list, but not the feeder pins.
- **Map key.** Lists only the constellations drawn on that map (at least one positioned node after the protocol and constellation filters). Pin colours are indexed over the full set so they never shift. Feeders are split by protocol through `filterManagedNodesByProtocol`. Below `sm` the key sits behind a "Map key" button. The phone map is about 260px tall so search shows in the first screen.

## Decisions

Each was decided in https://github.com/pskillen/meshflow-ui/issues/407.

- Node lists offer Online (2h) and the shared presets, with no "All time".
- The list never walks every page on its own: the first page is fetched, and "Load more" is the user's choice.
- The map key shows only what the map draws, and colours stay stable as filters change.
- The phone map is short so search and the first cards are visible without scrolling.

## Manual verify

1. Open the Meshtastic nodes page: the bar shows Online (2h), 24h, 7d, 30d, 90d, and no "All".
2. Pick 30d, go to another area and back: the range is remembered for node lists only.
3. On a big mesh, check "Showing the first X of Y", then "Load more" adds rows.
4. Type in search: the map pins and list both narrow, the feeder pins stay.
5. On a phone-width window: the map is short, search is in the first screen, and the key is behind "Map key".

## Known gaps

- `useMeshCore.ts` and `useObservedNodesHeard.ts` still walk every page; the trigger-traceroute map shows feeders of both protocols; several battery displays still format the raw level: https://github.com/pskillen/meshflow-ui/issues/446

## Related

- [Stats](README.md)
- [`useStatsRange`](../../../src/hooks/useStatsRange.md)
- [`StatsRangeBar`](../../../src/components/stats/StatsRangeBar.md)
