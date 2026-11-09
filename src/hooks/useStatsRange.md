# useStatsRange

## Purpose

The single source of the time range on a stats screen. Screens do not hold range state or compute bucket sizes of their own: they call this hook, hand the result to [`StatsRangeBar`](../components/stats/StatsRangeBar.md), and use `range.window` / `range.bucket` for queries and charts. Presets and bucket sizes live in `src/lib/stats-range.ts`.

## Inputs

```ts
useStatsRange({ area?, options?, local?, now? }): StatsRange
```

- `area` – name of the area the screen belongs to (for example `'dashboards'`, `'traceroutes'`). Screens in one area share the last chosen range. Leave it undefined for no memory.
- `options` – allowed range keys, default the four presets `24h`, `7d`, `30d`, `90d`. Add `'2h'` (Online) on node lists only. Pass a module-level constant, not an inline array, so `setRange` stays stable.
- `local` – keep the range in component state instead of the URL (see below).
- `now` – injected clock for tests.

## Returns

`{ key, def, label, longLabel, bucket, bucketLabel, window: { start, end, partialEnd, lastBucketStart }, options, setRange }`. The object is memoised: it is the same reference until the key, window or options change.

Read it as `range.window`. Destructuring `const { window } = useStatsRange()` shadows the browser's global `window` in that scope; rename on the way out (`const { window: rangeWindow } = ...`) if you destructure.

## Behaviour

- Resolution order (pinned by tests): valid `?range=` in the URL, then the last range remembered for `area` this session, then `7d` (or the first allowed option if `7d` is not allowed). A URL value that is not in `options` is ignored for resolution and then rewritten (with `replace`, other params kept) to the range actually in effect, so an invalid `?range=all` on a screen whose area remembers `30d` shows 30d and the URL says `range=30d`.
- `setRange` writes `?range=` with `replace: true`, keeps every other param (`tab`, `source_node`, `feeder`), and remembers the choice for the area. A range that arrives by URL is remembered too.
- Memory is `sessionStorage`, key `meshflow.statsRange.<area>`, every access in try/catch. If storage is blocked the range just is not remembered.
- `window` is stable across renders: it only changes with the key, once an hour for presets (they end at the top of the UTC hour) and every five minutes for Online (2h, which ends at now floored to the 5-minute tick, so every component gets the same value). That keeps query keys stable so Suspense queries do not remount.
- **UTC buckets; the last bucket is in progress.** Windows are computed in UTC, matching the API's rollups (UTC hour, 6h at 00/06/12/18 UTC, UTC day), whatever the browser's time zone. `start` is floored to the UTC boundary of the range's bucket so the first bucket is whole; `end` is the current UTC hour, so with 6h (7d) or daily (30d, 90d) buckets the last bucket is still filling. `window.partialEnd` says so and `window.lastBucketStart` is where that bucket begins, so charts can mark it rather than show a dip. Chart code that buckets with the local-time `getBucketStart` in `stats-aggregation.ts` will not line up with these windows outside UTC.

## Areas rule

The range carries within an area only: the dashboards (Home, Meshtastic, MeshCore) share one area, so moving between them by sidebar link keeps the range. A node's tabs share it through the URL (tab switching already copies the query string). A different node must not inherit it, so node pages pass no `area`. Heatmap and topology keep their own custom range and do not use this hook.

## Slide-over (`local: true`)

`NodeDetailContent` also renders inside `NodeDetailSheet` on other pages. With `local: true` the hook holds the range in state and never reads or writes the host page's URL or the area memory.

## Stat classes

Each stat on a screen is one of four classes; the range applies differently:

- **Live count** (online now, claimed nodes): ignores the range.
- **Gauge** (battery, channel utilisation, a latest value): value at the end of the window, trend over it.
- **Flow** (packets, message rate): summed or averaged per bucket across the window.
- **Events in range** (traceroutes, new nodes, disconnects): counted inside the window.

## Related

- `src/lib/stats-range.ts` – presets, windows, buckets (`statsRangeWindow`, `previousStatsWindow`).
- `src/lib/time-range.ts` – `windowForTimeRangeKey`, the older now-anchored window the heatmap/topology custom range still uses.
- First adopter: `TracerouteStatsPage`.
