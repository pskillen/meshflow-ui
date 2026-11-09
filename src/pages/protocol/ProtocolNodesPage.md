# ProtocolNodesPage

## Purpose

The node list for one protocol: Meshtastic at `/nodes`, MeshCore at `/meshcore/nodes`. A map on top, a search box, then the nodes heard in the chosen range. Which protocol it shows comes from `config` (`MESHTASTIC_CONFIG` / `MESHCORE_CONFIG`).

## Props / inputs

- `config: ProtocolPageConfig` – labels, routes and feature flags for the protocol.
- State from the URL and storage via [`useStatsRange`](../../hooks/useStatsRange.md) (`?range=`), plus local `searchQuery` and `sortBy`.

## Behaviour

- **Range bar** ([`StatsRangeBar`](../../components/stats/StatsRangeBar.md)) at the top, sticky: Online (2h), 24h, 7d, 30d, 90d. Default 7d. There is no "All". The range is in the URL (`?range=`) and is remembered for the `node-lists` area only (it does not carry to dashboards or traceroutes).
- The range drives one thing: `last_heard_after = range.window.start` on the observed-nodes query. Online (2h) is rolling (two hours back from now, floored to a five-minute tick); the longer presets are hour-aligned. The query key is rounded to five minutes in `useProtocolObservedNodesSuspense`, so the moving 2h window does not refetch on every render.
- **Search** sits between the map and the list, sticky just below the range bar. It matches long name, short name, node id and MeshCore prefix, and filters **both** the map and the list. Next to it: "N of M heard in last 7 days" (hidden on phones) and the Last Heard / Name sort.
- **Map**: Meshtastic uses `NodesAndConstellationsMap` (feeders, constellations, observed nodes); MeshCore uses `NodesMap` with feeders merged in via `buildMeshCoreMapNodes`. The map key is [`MapMarkerLegend`](../../components/nodes/MapMarkerLegend.md), a button on phones.
- **List**: Meshtastic shows a card grid; MeshCore splits into "With location" cards and an "Identity only / no position" table. Both load more pages with "Load more".
- Feeders need a login; signed-out visitors see the observed nodes only.

## Wiring

Routed from `App.tsx`. Data: `useProtocolObservedNodesSuspense`, `useManagedNodesSuspense` (Meshtastic), `useMeshCoreManagedNodesSuspense` (MeshCore). Cards are `NodeCard`.

## Related

- [`useStatsRange`](../../hooks/useStatsRange.md), [`StatsRangeBar`](../../components/stats/StatsRangeBar.md), [`MapMarkerLegend`](../../components/nodes/MapMarkerLegend.md).
- Tests: `ProtocolNodesPage.test.tsx`, `tests/browser/nodes-list.spec.ts`.
