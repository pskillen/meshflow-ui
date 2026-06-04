## Message heard dialog (MeshCore paths)

Opened from **N heard** on a MeshCore text message in message history.

### Layout

1. **Geo map** — [`HeardPathGeoMap`](../../src/components/messages/HeardPathGeoMap.tsx) ([docs](../../src/components/messages/HeardPathGeoMap.md)): Leaflet markers for sender (when position known) and feeders with coordinates, plus optional **partial hop polylines** when API resolves hop positions. Ambiguous hops are list-only. Meshtastic uses [`HeardPathMap`](../../src/components/messages/HeardPathMap.tsx) ([docs](../../src/components/messages/HeardPathMap.md)) for full sender→feeder paths.
2. **Paths by feeder** — One schematic row per observation: sender → hash hops → feeder. A single `mc_sender_candidate` is shown as the sender (with node link) even when the node has no map position; `HopPositionIcon` reflects position only. Hops use dashed monospace badges when unresolved; they are **not** placed at geographic coordinates unless the API supplies hop positions.
3. **Feeder list** — Each observer with RSSI/SNR and a **Path (this feeder)** column showing that observation’s hop chain.

Each feeder can report a **different** `path_hashes` / `resolved_path` for the same message.

### Related

- Tracking: [meshflow-ui#311](https://github.com/pskillen/meshflow-ui/issues/311)
- Passive path diagnostic tables: [passive-path-preview.md](./passive-path-preview.md) (`/meshcore/path-tracing`)
- Geographic hop placement on maps: deferred — see [meshflow-api packet-path-tracing outstanding](https://github.com/pskillen/meshflow-api/blob/main/docs/features/meshcore/packet-path-tracing/packet-path-tracing-outstanding.md)
