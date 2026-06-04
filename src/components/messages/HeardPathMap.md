# HeardPathMap

Leaflet map for the **message heard** dialog that shows **sender, feeders (receivers), and path geometry**: solid polylines where hop positions are known, dashed lines with hash tooltips where they are not.

Use this when each observation leg can be drawn as a geographic path from sender through waypoints to the hearing feeder—primarily **Meshtastic** heard UI today.

## When to use

| Use `HeardPathMap`                                                                             | Use `HeardPathGeoMap` instead                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Meshtastic `HeardDialog` branch in [`MessageItem.tsx`](./MessageItem.tsx)                      | MeshCore heard dialog top map (markers only; hops shown schematically below) |
| Legs include `waypoints` + `pathKnown` from `messageToHeardPathLegs` / `meshtasticHeardToLegs` | You only need sender + feeder pins with no on-map hop geometry               |

These components are **not** drop-in replacements: `HeardPathMap` expects per-leg `HeardPathLeg` objects with waypoints; `HeardPathGeoMap` expects a flat `feeders[]` list.

## Props

| Prop         | Type                          | Role                                                              |
| ------------ | ----------------------------- | ----------------------------------------------------------------- |
| `sender`     | `{ label, position } \| null` | Path start marker (green)                                         |
| `legs`       | `HeardPathLeg[]`              | One entry per feeder observation that has a **receiver position** |
| `senderName` | `string \| null`              | Banner label when sender position is missing                      |

### `HeardPathLeg`

| Field       | Role                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `receiver`  | Feeder marker (`label`, `position`)                                       |
| `waypoints` | Intermediate hops as `TracerouteRouteNode[]` (`position` optional)        |
| `pathKnown` | From API `path_known`: all hops resolved with positions                   |
| `lineColor` | Polyline and feeder marker colour (defaults from `HEARD_PATH_LEG_COLORS`) |

Legs without a receiver position are omitted upstream (`meshtasticHeardToLegs` / `meshCoreHeardToLegs`).

## What it draws

For each leg (feeder colour by index):

1. **Receiver marker** at `receiver.position`.
2. **Path lines** only if **sender position is known** (`senderPos`). If sender is missing, feeder markers still render but **no polylines** (banner: path lines omitted).
3. **Segment mode** (when `senderPos` exists):
   - **`pathKnown` and at least one waypoint with `position`**: [`buildSegments`](../../../lib/map-path-segments.ts) — solid runs through known coordinates; dashed segments between known points with permanent tooltips showing `node_id_str` (hash) for unknown hops in that span.
   - **Otherwise**: single **dashed** line sender → feeder; tooltips list all waypoint `node_id_str` values at the segment midpoint.

Sender marker uses `HEARD_PATH_SENDER_COLOR`. Map height **280px** (vs 240px on geo map).

## Empty and warning states

- **`legs.length === 0`**: placeholder — either “No feeder positions available for map” (sender known) or “No map — sender and feeder positions unknown”.
- **Sender missing, legs present**: amber overlay — sender position unknown; feeders shown; **path lines omitted**.

## Data adapters

| Adapter                 | Protocol   | Output                                                                                                                                          |
| ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `meshtasticHeardToLegs` | Meshtastic | Sender from `sender_position`; legs from `heard[]` with `observer_position`; empty `waypoints`                                                  |
| `meshCoreHeardToLegs`   | MeshCore   | Waypoints from `resolved_path` / `path_hashes`; used by tests and available for future MC map work—not wired in `MeshCoreHeardDialogBody` today |

Entry point: `messageToHeardPathLegs(message)` in [`heard-path-map-adapters.ts`](./heard-path-map-adapters.ts).

## Related

- [`HeardPathGeoMap.md`](./HeardPathGeoMap.md) — anchor-only map for MeshCore
- [`MeshCoreHeardPathsPanel.tsx`](./MeshCoreHeardPathsPanel.tsx) — schematic per-feeder hop chains (MC)
- [`docs/meshcore/heard-path-dialog.md`](../../../docs/meshcore/heard-path-dialog.md) — full dialog layout
