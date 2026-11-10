# battery (`src/lib/battery.ts`)

## Purpose

The one place that interprets a raw device-metrics `battery_level`. Meshtastic reports `101` for an externally powered node, which must read "Powered", not "100%". `0` is a real reading, not "no data".

## API

- `describeBattery(raw)` returns `{ kind: 'none' }` (null, undefined, NaN, or negative), `{ kind: 'powered' }` (101 or more), or `{ kind: 'level', pct, tone }` (rounded, then clamped to 0-100, so 100.5 reads 100%; tone `good` above 60, `warn` above 20, else `low`).
- `formatBattery(raw)` returns `"Powered"`, `"87%"` or `"—"`.
- `batteryTone(pct)` and `POWERED_BATTERY_LEVEL`.

## Wiring

`BatteryIndicator` in `NodeCard.tsx` and the `NodesTable` battery cell and sort rank use it. Other battery displays still format the raw level themselves (`MonitoredNodesTable` and `NodeSelector` hide a real 0): `InfrastructureNodeCard`, `MonitoredNodesTable`, `NodeSelector`, `MyNodeCard`, `WatchedNodesTable`, `NodeActivityTable`, `NodeDetailContent`, `MeshInfrastructure` and `infrastructure-export-rows`; `BatteryGauge` and the chart components clamp locally. They should move onto this helper.

## Related

- [`StatTile`](../components/stats/StatTile.md)
