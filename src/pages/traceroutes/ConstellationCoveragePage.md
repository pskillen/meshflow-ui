# ConstellationCoveragePage

## Purpose

Map of traceroute coverage combined across every managed node in a constellation: H3 hexes, target dots, feeder towers, optional heard-only nodes.

## Behaviour

- Toolbar: title with an info button (description in a dialog), constellation select, H3 resolution and min attempts, then the shared range presets 24h / 7d / 30d / 90d pinned right (they drop to their own right-aligned row if the filters leave no room). Under it: layer pills and a collapsed "Strategies: All" menu ([`CoverageStrategyMenu`](../../components/traceroutes/CoverageStrategyMenu.md)). On narrow screens the filters are two columns.
- Range is `?range=` (default 7d); the query string is kept when the constellation changes. No custom range. The window start is the fixed N x 24h start from the shared range module and also bounds the Heard layer.
- Without a constellation in the path it redirects to the first one.

## Related

[`useMapRange`](../../hooks/useMapRange.md), [`MapInfoButton`](../../components/traceroutes/MapInfoButton.md), [`FeederCoveragePage`](./FeederCoveragePage.md).
