# RightNowBand

## Purpose

The one "Right now" block for the Home, Meshtastic and MeshCore dashboards. It replaces three copied "Recently active" tables. It shows how many nodes were heard in fixed windows ending now; these are not affected by the stats range.

## Props

- `RightNowBand({ scope })` – `scope` is `'both' | 'meshtastic' | 'meshcore'`. It fetches counts itself with `useRecentNodeCountsSuspense`, so use it inside a `Suspense` boundary.
- `RightNowCounts({ scope, meshtastic?, meshcore? })` – the presentational part; counts are passed in (used by tests and anything that already has the data).
- The columns live once in `COUNT_COLUMNS` in `src/lib/recent-node-counts.ts`.

## Behaviour

- Five windows: Online now (2h, emphasised), Active today (24h), Active this week (7d), Active this month (30d), Known recently (90d). "All time" is not shown. A missing window counts as 0.
- Desktop (`md` and up): five `StatTile`s. For `both` each tile shows the total with `MT n · MC n` beneath; for a protocol page just its own number.
- Phones: a compact table (`Heard in | 2h 24h 7d 30d 90d`), one row per protocol for `both`, a single "Nodes" row otherwise, so charts start above the fold. The explanatory note is hidden on phones.
- Test ids: `right-now-band`, `right-now-tiles`, `right-now-tile-<hours>`, `right-now-table`.

## Wiring

`Dashboard` (`both`), `MeshtasticDashboard`, `MeshCoreDashboard`.

## Related

- [`StatTile`](StatTile.md), [`StatsRangeBar`](StatsRangeBar.md)
