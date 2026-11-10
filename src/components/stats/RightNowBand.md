# RightNowBand

## Purpose

The one "Right now" block for the Home, Meshtastic and MeshCore dashboards. It replaces three copied "Recently active" tables. It shows how many nodes were heard in fixed windows ending now; these are not affected by the stats range.

## Props

- `RightNowBand({ scope })` – `scope` is `'both' | 'meshtastic' | 'meshcore'`. It fetches counts itself (`both` fetches the two protocols in parallel under the same query keys as `useRecentNodeCountsSuspense`) and carries its own `Suspense` (fixed-height skeleton) and error boundary: a slow or failed request affects only the band, which shows a small inline error with Retry. A 401 is passed up to the app's auth boundary.
- `RightNowCounts({ scope, meshtastic?, meshcore? })` – the presentational part; counts are passed in (used by tests and anything that already has the data).
- The columns live once in `COUNT_COLUMNS` in `src/lib/recent-node-counts.ts`.

## Behaviour

- Five windows: Online now (2h, emphasised), Active today (24h), Active this week (7d), Active this month (30d), Known recently (90d). "All time" is not shown. A window the API did not report shows "—"; a `both` total sums only the protocols that reported it.
- Wide screens (`lg` and up): five `StatTile`s. For `both` each tile shows the total with `MT n · MC n` beneath; for a protocol page just its own number.
- Below `lg`: a compact table (`Heard in | 2h 24h 7d 30d 90d`), one row per protocol for `both`, a single "Nodes" row otherwise, so charts start above the fold. The explanatory note is hidden on phones.
- Accessibility: the section is labelled by its heading; the table has a caption, `scope`d headers (each window header is named in full, e.g. "Online now, heard in last 2h") and row headers; the tiles are a `role="list"`.
- Numbers use `en-GB` separators.
- Test ids: `right-now-band`, `right-now-tiles`, `right-now-tile-<hours>`, `right-now-table`, `right-now-skeleton`, `right-now-error`.

## Wiring

`Dashboard` (`both`), `MeshtasticDashboard`, `MeshCoreDashboard`.

## Related

- [`StatTile`](StatTile.md), [`StatsRangeBar`](StatsRangeBar.md)
