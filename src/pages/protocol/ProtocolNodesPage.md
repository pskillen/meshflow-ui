# ProtocolNodesPage

## Purpose

The node list for one protocol: Meshtastic at `/nodes`, MeshCore at `/meshcore/nodes`. A range bar and search on top, a map, then the nodes heard in the chosen range. Which protocol it shows comes from `config` (`MESHTASTIC_CONFIG` / `MESHCORE_CONFIG`).

## Props / inputs

- `config: ProtocolPageConfig` – labels, routes and feature flags for the protocol.
- State from the URL and storage via [`useStatsRange`](../../hooks/useStatsRange.md) (`?range=`), plus local `searchQuery`. Sorting lives in [`NodesTable`](../../components/nodes/NodesTable.md).

## Behaviour

- **Sticky chrome**: one sticky wrapper at the top holds the range bar and the search row, so there is no offset to keep in step between them. On a 375px phone it is about 95px tall (bar 50px, search row 45px); the search takes the whole second line.
- **Range bar** ([`StatsRangeBar`](../../components/stats/StatsRangeBar.md)): Online (2h), 24h, 7d, 30d, 90d. Default 7d. There is no "All". The range is in the URL (`?range=`) and is remembered for the `node-lists` area only (it does not carry to dashboards or traceroutes). An unknown `?range=` such as the retired `all` is ignored and rewritten: it shows the range remembered for node lists this session, or 7d when there is none.
- The range drives one thing: `last_heard_after = range.window.start` on the observed-nodes query. Online (2h) is rolling (two hours back from now, floored to a five-minute tick). The longer presets end at the current UTC hour, and their start is floored to the bucket boundary of the range (6 hours for 7d, a UTC day for 30d and 90d), so a "7d" list can reach back a little more than 7 days. The query key is rounded to five minutes in `useProtocolObservedNodesSuspense`, so the moving 2h window does not refetch on every render.
- **Search** matches long name, short name, node id and MeshCore prefix, and filters **both** the map and the list. It does not filter the managed feeders drawn on the map: those always show (signed-in users only), so a search can leave feeder markers on a map with no matching observed nodes.
- **Count**: one line above the list, "Showing N of M nodes heard in last 7 days" (N after search, M the total for the range). The list heading carries no count. ui#419 adds a separate "Showing the first X of Y" notice for the server cap; that one is about truncation, this one about the filter.
- **Map**: Meshtastic uses `NodesAndConstellationsMap` (feeders, constellations, observed nodes); MeshCore uses `NodesMap` with feeders merged in via `buildMeshCoreMapNodes`. Both take `minHeightClassName`; the page gives the map box 260px on phones (600px from `sm` up, minimum 400px), so the search and the first cards are in the first phone screen. The map key is [`MapMarkerLegend`](../../components/nodes/MapMarkerLegend.md), a button on phones. Both protocols show one key by role (Meshtastic passes `legendLayout="role"`, with one "Monitoring node" row for the constellation-coloured feeder pins; no constellation column).
- **List**: "Recent Nodes", one [`NodesTable`](../../components/nodes/NodesTable.md) for both protocols (sortable headers; Meshtastic: name, ID, role, hardware, battery, last heard; MeshCore: name, ID, prefix, position, last heard, in one table with no separate identity-only section). The old sort toggle is gone. "Load more" fetches the next page when there is one.
- Feeders need a login; signed-out visitors see the observed nodes only.

## Wiring

Routed from `App.tsx`. Data: `useProtocolObservedNodesSuspense`, `useManagedNodesSuspense` (Meshtastic), `useMeshCoreManagedNodesSuspense` (MeshCore). The table is `NodesTable`.

## Related

- [`useStatsRange`](../../hooks/useStatsRange.md), [`StatsRangeBar`](../../components/stats/StatsRangeBar.md), [`MapMarkerLegend`](../../components/nodes/MapMarkerLegend.md).
- [`NodesTable`](../../components/nodes/NodesTable.md).
- Tests: `ProtocolNodesPage.range.test.tsx`, `tests/browser/nodes-list.spec.ts`.
