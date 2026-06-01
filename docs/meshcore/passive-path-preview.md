## Passive path tracing (preview)

Route: `/meshcore/path-tracing`

This page is a **diagnostic MVP** for MeshCore passive packet path tracing (API milestone M1). It lists:

- **Segments** — hash segments from ingest rollups, with `hash_size`, `hash_mode`, and resolution `status`. Unknown hashes use dashed styling consistent with heard-path maps.
- **Edges** — hourly hash→hash buckets derived from list-order `path_hashes` chains. The direction column shows the API value `list_order` (packet list order, not RF forwarding direction).

Staff users can manually annotate a segment (link hash to an observed node) via `PATCH /api/meshcore/path-tracing/segments/{id}/`.

This preview supports **M2 decision-making** (mode/size distribution, chain sanity). The full map, realtime buffer, and centrality UI are tracked separately as [meshflow-ui#309](https://github.com/pskillen/meshflow-ui/issues/309) (M7), building on API work in [meshflow-api#372](https://github.com/pskillen/meshflow-api/issues/372).

For **per-message** passive paths in the heard dialog (logical hop chains per feeder), see [heard-path-dialog.md](./heard-path-dialog.md) ([#311](https://github.com/pskillen/meshflow-ui/issues/311)).
