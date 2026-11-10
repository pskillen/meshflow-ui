# FirmwareAdoptionCard

## Purpose

Dashboard card showing which Meshtastic firmware generations nodes are running: a stacked bar and counts for the latest snapshot ("Split: nodes heard in the last 7d"; the phrase comes from the snapshot's `window_hours`, "nodes heard recently" when unknown) and a line trend that follows the dashboards' range. Used on the Meshtastic dashboard only. It is not a per-node view. Built on `ChartCard` and `TrendChart`.

## Props / inputs

- `range: StatsRange` from `useStatsRange({ area: 'dashboards' })`. It sets the trend only.
- One `useStatsSnapshots` request (`stat_type=node_firmware`, `constellation_id=-1`, `page_size=1000`) feeds both parts. It reaches back to the range start, or `ADOPTION_SPLIT_LOOKBACK_DAYS` (3) if that is nearer, so the split still has a snapshot on a 24h range. The newest row drives the split; rows inside the range drive the trend.

## Behaviour

- The split does not move with the range bar: it is a live count with its own window, taken from the snapshot's `window_hours` ("last 7d"). The headline is that snapshot's node total.
- Phones: no graphic for the split. Counts only (label, count, percentage, as a wrapping list); the bar is `hidden md:flex`. The trend stays. There is no pie.
- The trend is always on a UTC-day grid (`buildFirmwareTrend`), whatever the range's bucket: `node_firmware` is one snapshot a day, so a 24h range shows one or two points and a note says how many ("Only N daily snapshots in this range.", or "No snapshots in this range."). Dots are drawn on every point so a lone snapshot is visible. The grid starts at the UTC day of the range start.
- Series logic lives in `src/lib/firmware-adoption.ts` (`buildFirmwareAdoption`). The key universe is the union of `by_type` keys over all fetched rows, so split and trend agree.
- Label rules: numeric keys sort by dotted parts (`2.7` < `2.8` < `2.10`). Lowest is `"<key> or earlier"`, highest `"<key>+"`, middle keys plain; a single numeric key counts as lowest. Non-numeric keys follow, verbatim. `unknown` is always last and labelled exactly "Unknown" (nodes with no evidence; nothing more is assumed). A new generation such as `2.9` needs no code change.
- Series use safe ids (`series0`, ...) as `TrendChart` row keys; raw keys contain dots.
- Colours are `--chart-1..5` by position (wrapping after five); Unknown is `--muted-foreground`. The count list doubles as the legend (swatch and label). Unknown is dashed in the trend (`TrendChart`'s per-series `dashed`) and striped in the split bar, with a gap between segments, so it is never told apart by colour alone. The trend's own legend is off (`legend={false}`): the count list is the legend. The trend does not share hover (`syncId`) with the stats charts: it is one point a day, and their grids are hourly or 6-hourly on short ranges. Known limit: light-mode `--chart-4`/`--chart-5` have low contrast on a white card.
- Percentages under 1% show as "<1%". The note explains the current "+" label (derived from the data) and "Unknown".
- The trend has the sr-only value table and chart name that `TrendChart` gives every chart.
- States: loading skeleton, error message, and "No firmware data yet" when there are no rows, none carry `by_type`, or the newest row totals zero (including before the API deploys the stat).

## Wiring

Rendered in `MeshtasticDashboardContent` (`src/pages/meshtastic/MeshtasticDashboard.tsx`) last on the page, below `MeshStatsSection`, passing the page's range. Uses the non-Suspense `useStatsSnapshots` so a failing stat cannot take the dashboard down.

## Related

- API stat `node_firmware` in meshflow-api (`GET /api/stats/snapshots/`; value has `count`, `window_hours`, `by_type`, `by_basis`). `by_basis` is typed but not charted.
- `NeighbourSourceBars` for the card/loading/error precedent.
