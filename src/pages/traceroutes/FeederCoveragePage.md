# FeederCoveragePage

## Purpose

Map of one managed node's traceroute reach: per-target reliability dots, hex bins, a polygon, and optional heard-only nodes.

## Behaviour

- Toolbar: title with an info button (the long description lives in a dialog, see `MapInfoButton`), feeder select and min attempts, then the shared range presets 24h / 7d / 30d / 90d pinned right. Under it: layer pills and a collapsed "Strategies: All" menu ([`CoverageStrategyMenu`](../../components/traceroutes/CoverageStrategyMenu.md)). On narrow screens the filters are two columns.
- Range is `?range=` (default 7d, shared with the other traceroute pages this session). No custom range here. The window start is the fixed N x 24h start from the shared range module, sent as `triggered_at_after`; the same date bounds the Heard layer.
- 90d is the longest window; the endpoint has no server cap, so it is the most expensive load.
- `?feeder=` is kept in sync with the select.
- The Heard layer loads one page of 1,000 nodes and never walks further. When more were heard in the window, a status line under the layer pills says "Heard layer shows the first 1,000 of N nodes heard since <date>".

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapInfoButton`](../../components/traceroutes/MapInfoButton.md), [`ConstellationCoveragePage`](./ConstellationCoveragePage.md).
