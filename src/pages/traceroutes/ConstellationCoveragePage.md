# ConstellationCoveragePage

## Purpose

Map of traceroute coverage combined across every managed node in a constellation: H3 hexes, target dots, feeder towers, optional heard-only nodes.

## Behaviour

- Toolbar: title, constellation select, H3 resolution, min attempts and an info button (description in a dialog), then the shared range presets 24h / 7d / 30d / 90d. Layer pills and strategy checkboxes sit under it.
- Range is `?range=` (default 7d); the query string is kept when the constellation changes. No custom range. The window start is the fixed N x 24h start from the shared range module and also bounds the Heard layer.
- Without a constellation in the path it redirects to the first one.

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapInfoButton`](../../components/traceroutes/MapInfoButton.md), [`FeederCoveragePage`](./FeederCoveragePage.md).
