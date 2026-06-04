# HeardPathGeoMap

Leaflet map for the **message heard** dialog that shows **only geographic anchors** (sender and feeders). It does **not** draw hop polylines, path segments, or hash labels on the map.

Use this when hop evidence is hash-based or schematic and should not be interpreted as real-world RF geometry on the map—typical for **MeshCore** heard dialogs today.

## When to use

| Use `HeardPathGeoMap`                                                                       | Use `HeardPathMap` instead                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| MeshCore heard dialog top map (markers for “who” heard the message and where they sit)      | Meshtastic heard dialog, or any case where you want sender → hop waypoints → feeder **lines** on the map |
| You will show the full hop chain elsewhere (e.g. `MeshCoreHeardPathsPanel`, `PathHopChain`) | `path_known` and/or positioned intermediate hops should appear as polylines                              |

These components are **not** drop-in replacements: props and rendering models differ (see below).

## Props

| Prop         | Type                         | Role                                                                                |
| ------------ | ---------------------------- | ----------------------------------------------------------------------------------- |
| `sender`     | `HeardPathGeoAnchor \| null` | Sender marker when `position` is known                                              |
| `feeders`    | `HeardPathGeoAnchor[]`       | One marker per feeder/feeder with a known position                                  |
| `senderName` | `string \| null`             | Label for the amber banner when sender position is missing (e.g. `mc_sender_label`) |

`HeardPathGeoAnchor`: `{ label, position, color? }`. Feeder `color` defaults from `HEARD_PATH_LEG_COLORS` by index.

## What it draws

1. **Sender** (green, `HEARD_PATH_SENDER_COLOR`) — if `sender` is non-null.
2. **Feeder markers** — one per entry in `feeders`, with per-leg colour when `color` is set.
3. **No polylines** — no use of `buildSegments` or `path_hashes` / `resolved_path`.

Map bounds fit all markers (padding, max zoom 15). Default centre before fit: Glasgow area (`55.8642, -4.2518`).

## Empty and warning states

- **Empty** (`!sender && feeders.length === 0`): placeholder text — “No map — sender and feeder positions unknown” (`data-testid="heard-path-geo-map-empty"`).
- **Sender missing, feeders present**: amber overlay — sender position unknown; feeders shown; **hop paths are schematic below** (paths belong in `MeshCoreHeardPathsPanel` / list, not on this map).

## Wiring in the app

[`MessageItem.tsx`](./MessageItem.tsx) → `MeshCoreHeardDialogBody` builds `geoSender` and `geoFeeders` from `meshCoreHeardLegs(message)` (feeders with `receiverPosition` only) and renders `HeardPathGeoMap`.

Data still comes from message `heard[]` / API; this component only consumes **positions**, not hop hashes.

## Related

- [`HeardPathMap.md`](./HeardPathMap.md) — path polylines and hop geometry
- [`heard-path-map-adapters.ts`](./heard-path-map-adapters.ts) — `meshCoreHeardLegs`, Meshtastic vs MC adapters
- [`docs/meshcore/heard-path-dialog.md`](../../../docs/meshcore/heard-path-dialog.md) — full dialog layout
