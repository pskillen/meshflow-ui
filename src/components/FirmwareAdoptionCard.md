# FirmwareAdoptionCard

## Purpose

Dashboard card showing which Meshtastic firmware generations nodes are running: a donut of the latest snapshot and a line of the last 90 days. Used on the Meshtastic dashboard only. It is not a per-node view.

## Props / inputs

No props. One `useStatsSnapshots` request (`stat_type=node_firmware`, `constellation_id=-1`, last `ADOPTION_HISTORY_DAYS` days, `page_size=1000`) feeds both charts; the newest row drives the pie.

## Behaviour

- Series logic lives in `src/lib/firmware-adoption.ts` (`buildFirmwareAdoption`). The key universe is the union of `by_type` keys over all rows, so pie and line agree.
- Label rules: numeric keys sort by dotted parts (`2.7` < `2.8` < `2.10`). Lowest is `"<key> or earlier"`, highest `"<key>+"`, middle keys plain; a single numeric key counts as lowest. Non-numeric keys follow, verbatim. `unknown` is always last and labelled exactly "Unknown" (nodes with no evidence; nothing more is assumed). A new generation such as `2.9` needs no code change.
- Series use safe ids (`series0`, ...) for Recharts `dataKey` and `ChartConfig`; raw keys contain dots.
- Colours are `--chart-1..5` by position (wrapping after five); Unknown is `--muted-foreground` and drawn dashed, and the line chart has a legend with a line sample per series, so series are told apart without hue alone. Shared chart tokens are unchanged. Known limit: light-mode `--chart-4`/`--chart-5` have low contrast on a white card.
- Line values are node counts (rolling-window counts, not summed). Dots are always shown so a single snapshot is visible. A key missing from a day is 0.
- A text breakdown (label, count, percentage) sits under the charts, with a note explaining the current "+" label (derived from the data, so it follows the highest generation) and "Unknown". Percentages under 1% show as "<1%".
- The description states the window from `windowHours` (e.g. "Nodes heard in the last 7 days").
- States: loading spinner, error message, and "No firmware data yet" when there are no rows, none carry `by_type`, or the newest row totals zero (including before the API deploys the stat).

## Wiring

Rendered in `MeshtasticDashboardContent` (`src/pages/meshtastic/MeshtasticDashboard.tsx`) between the "Right now" band and `MeshStatsSection`. Uses the non-Suspense `useStatsSnapshots` so a failing stat cannot take the dashboard down.

## Related

- API stat `node_firmware` in meshflow-api (`GET /api/stats/snapshots/`; value has `count`, `window_hours`, `by_type`, `by_basis`). `by_basis` is typed but not charted.
- `NeighbourPieChart` for the card/loading/error precedent.
