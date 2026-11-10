# NodeRightNow

## Purpose

"Right now" for one node: the latest readings (battery, channel utilisation, air utilisation TX, uptime, last heard). Fixed to the latest report, so it is not affected by the time range. Use `RightNowBand` for mesh-wide node counts instead.

## Props

- `node: ObservedNode` – readings come from `latest_device_metrics` and `last_heard`.
- `note?: string` – one line under the heading (desktop only).

## Behaviour

- Built by `buildNodeNowCells` (`src/lib/node-now.ts`): Battery (hero tile, volts underneath), Channel util, Air util TX, Uptime (`14d`, `5h`, `12m`), Last heard (`3h ago`).
- Battery goes through `describeBattery`: raw 101 reads "Powered", 0 is a real 0%, missing is an em dash.
- Without device metrics (a MeshCore node may have none) only Last heard shows.
- From `md` up: tiles (`StatTile`) in a row. On phones: a one-row table with short headings (Battery, Ch util, Air TX, Uptime, Heard).

## Wiring

Rendered by `NodeDetailContent` at the top of the Overview and Statistics panels. Test ids: `node-right-now`, `node-right-now-tiles`, `node-right-now-table`, `node-right-now-tile-<key>`.

## Related

[`../stats/StatTile.md`](../stats/StatTile.md), [`../stats/RightNowBand.md`](../stats/RightNowBand.md), `src/lib/battery.ts`.
