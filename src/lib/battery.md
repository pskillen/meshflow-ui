# battery (`src/lib/battery.ts`)

## Purpose

The one place that interprets a raw device-metrics `battery_level`. Meshtastic reports `101` for an externally powered node, which must read "Powered", not "100%". `0` is a real reading, not "no data".

## API

- `describeBattery(raw)` returns `{ kind: 'none' }` (null, undefined, NaN), `{ kind: 'powered' }` (101 or more), or `{ kind: 'level', pct, tone }` (clamped and rounded to 0-100; tone `good` above 60, `warn` above 20, else `low`).
- `formatBattery(raw)` returns `"Powered"`, `"87%"` or `"—"`.
- `batteryTone(pct)` and `POWERED_BATTERY_LEVEL`.

## Wiring

`BatteryIndicator` in `NodeCard.tsx` (exported). Node pages and node lists adopt it in later phases; `BatteryGauge` and the chart components still clamp locally.

## Related

- [`StatTile`](../components/stats/StatTile.md)
