## Message heard dialog (MeshCore paths)

Opened from **N heard** on a MeshCore text message in message history.

### Layout

1. **Geo map** — [`HeardPathGeoMap`](../../src/components/messages/HeardPathGeoMap.tsx) ([docs](../../src/components/messages/HeardPathGeoMap.md)): Leaflet markers for sender (when position known) and feeders with coordinates. No hop polylines. Not the same as [`HeardPathMap`](../../src/components/messages/HeardPathMap.tsx) ([docs](../../src/components/messages/HeardPathMap.md)), which Meshtastic uses for sender→feeder path lines.
2. **Paths by feeder** — One schematic row per observation: sender → hash hops → feeder. Hops use dashed monospace badges (`unknown` per API v1); they are **not** placed at geographic coordinates.
3. **Feeder list** — Each observer with RSSI/SNR and a **Path (this feeder)** column showing that observation’s hop chain.

Each feeder can report a **different** `path_hashes` / `resolved_path` for the same message.

### Related

- Tracking: [meshflow-ui#311](https://github.com/pskillen/meshflow-ui/issues/311)
- Passive path diagnostic tables: [passive-path-preview.md](./passive-path-preview.md) (`/meshcore/path-tracing`)
- Geographic hop placement on maps: deferred — see [meshflow-api packet-path-tracing outstanding](https://github.com/pskillen/meshflow-api/blob/main/docs/features/meshcore/packet-path-tracing/packet-path-tracing-outstanding.md)
