# MeshStatsSection

## Purpose

The "Over the range" block of the three dashboards (Home, Meshtastic, MeshCore): Online nodes, New nodes and Packet volume for the range chosen on the page's `StatsRangeBar`. It has no range selector of its own.

## Props

- `protocolScope?: 'both' | 'meshtastic' | 'meshcore'` (default `both`). `both` overlays the two protocols; the others show one.
- `range: StatsRange` – from `useStatsRange({ area: DASHBOARDS_AREA })`, called by the page that renders the bar, so the bar and the charts always agree.

## Behaviour

- Layout: Online nodes full width, New nodes and Packet volume side by side from `md` up, stacked on phones. All three share an x-axis and hover (`syncId`).
- Each chart is a [`ChartCard`](stats/ChartCard.md) (headline, measure pill, note) around a [`TrendChart`](stats/TrendChart.md). Online nodes is a line with a headline "avg N" (mean per bucket); New nodes and Packet volume are bars with the total as headline.
- Colour follows the protocol on every dashboard: Meshtastic `--chart-1`, MeshCore `--chart-4`. Packet volume "By type" uses the packet-type palette instead.
- Packet volume keeps its Total / By type toggle on single-protocol dashboards (hidden when overlaying both: the by-type split is per protocol).
- Buckets come from the range: 24h hourly, 7d 6-hour, 30d and 90d UTC days.
- 30d and 90d request `bucket=1d` from `GET /api/stats/snapshots/` (rolled-up days, `value.samples` says how many hours each covers) and always send `recorded_at_after`, as the API requires. Other ranges read hourly rows and aggregate here (UTC buckets). An API that ignores `bucket` returns hourly rows; they are rolled up here the same way, and a note appears if the API returned only part of the range.
- The bucket in progress (and a first bucket with too few samples) is drawn faded/dashed and labelled "partial bucket" in the tooltip.
- A note under each chart says what the dashes mean and, on hourly and 6-hour charts, which bucket is the latest point. An Online nodes point at hour H counts the nodes heard in the 2h around it, [H-1h, H+1h].
- When the API ignored `bucket` and returned only part of the range, the note says so and the headline reads "(partial)": the total or mean covers only the rows returned, not the whole range.
- Each headline shows the change against the previous period of the same length ("+12% vs previous 7d", neutral colour). It compares whole buckets on the same UTC grid (the bucket in progress is left out on both sides, and the note says so), gauges average and flows sum (scaled to the full window when hours are missing, each protocol needing 90% on its own), and the delta stays on the total in the By type view. It reads "No comparison" (the reason is in its tooltip) when either side has under 90% of its hourly snapshots, the previous total is 0, or a page was truncated; the line stays empty (its height reserved) while the previous window loads, and the previous window is not refetched on a timer. The previous window is one non-blocking request per stat type (Home with both protocols makes 12 snapshot requests per range), so a slow or failed one never blanks the chart. Not shown on Right now or firmware adoption: those are live counts with their own windows. On 24h the headline sums every row returned, while the delta uses exactly 24 whole hourly buckets, so the two can differ by the boundary row. See `src/lib/stats-delta.ts`.
- Each chart has its own Suspense skeleton, so changing the range does not blank the page.

## Wiring

Rendered by `Dashboard.tsx`, `MeshtasticDashboard.tsx` and `MeshCoreDashboard.tsx` under their `StatsRangeBar`. Data comes from `useStatsSnapshotsForTypesSuspense`; rows are built by `src/lib/stats-trend-data.ts` (`snapshotParamsForRange`, `buildCountRows`, `buildByTypeRows`).

## Related

- [`TrendChart`](stats/TrendChart.md), [`ChartCard`](stats/ChartCard.md), [`StatsRangeBar`](stats/StatsRangeBar.md), [`RightNowBand`](stats/RightNowBand.md), `src/hooks/useStatsRange.md`
- API: `GET /api/stats/snapshots/` with `bucket=1d` (meshflow-api, packet-stats docs).
