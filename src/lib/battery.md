# battery (`src/lib/battery.ts`)

## Purpose

The one place that interprets a raw device-metrics `battery_level`. Meshtastic reports `101` for an externally powered node, which must read "Powered", not "100%". `0` is a real reading, not "no data".

## API

- `describeBattery(raw)` returns `{ kind: 'none' }` (null, undefined, NaN, or negative), `{ kind: 'powered' }` (101 or more), or `{ kind: 'level', pct, tone }` (rounded, then clamped to 0-100, so 100.5 reads 100%; tone `good` above 60, `warn` above 20, else `low`).
- `formatBattery(raw)` returns `"Powered"`, `"87%"` or `"—"`.
- `batteryTone(pct)` and `POWERED_BATTERY_LEVEL`.
- `batteryToneClass(raw)` returns the text colour class: green, yellow or red for a level, `text-muted-foreground` for "Powered" or no data.
- `batteryChartValue(raw)` returns the percentage for a level, or `null` (a chart gap) for "Powered" and no data.

## Wiring

Every battery display reads through this helper: `BatteryIndicator` in `NodeCard.tsx`, `NodesTable` (cell and sort rank), `BatteryGauge` (and `MyNodeCard` through it), `InfrastructureNodeCard`, `MonitoredNodesTable`, `NodeSelector`, `WatchedNodesTable`, `NodeActivityTable` and the Mesh Infrastructure low-battery table (text only). `batteryToneClass(raw)` gives the icon colour class. The charts (`NodeMiniChart`, `MonitoredNodesBatteryChart`) plot `batteryChartValue(raw)`: the percentage, or a gap for "Powered" and missing. `infrastructure-low-battery.ts` decides low through `describeBattery`, so a missing level is never low and 101 is never low; a node with metrics but a null level goes in the "No battery telemetry" bucket. The infrastructure export's Battery % column is the number for a level, `Powered` for 101 and blank for none. `DeviceMetrics.battery_level` (and voltage, channel utilisation, air util TX, uptime) are `number | null`, matching the API.

## Related

- [`StatTile`](../components/stats/StatTile.md)
