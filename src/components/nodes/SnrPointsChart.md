# SnrPointsChart

## Purpose

The Raw view of a link's SNR on the node Traceroutes tab: every traceroute sample as a dot at its own time, for one peer. Used by [`LinkSNRCharts`](./LinkSNRCharts.md) inside a `ChartCard` when the Means / Raw toggle is on Raw.

## Props

- `points: RawSnrPoint[]` - the link's samples in the window, oldest first (`rawLinkSnr` in `src/lib/node-traceroute-snr.ts`).
- `window`, `bucket` - the page's range window and bucket. The x axis runs from `window.start` to the end of the last drawn bucket (`snrWindowEndMs`, the same bound the Means view uses), with the same UTC tick labels as the Means view (`evenTrendTicks` on the bucket grid, fewer on a narrow chart).
- `yRange`, `yTickStep` - the fixed SNR scale (-20 to 10 dB, a tick every 10). Samples outside it are clipped.
- `label` - accessible name stem ("SNR with PEER, last 7 days").
- `height` - default 190, the same as the other cards.

## Behaviour

- A Recharts `ScatterChart` with a numeric time x axis. Inbound is a filled circle (`--chart-1`), outbound a hollow triangle (`--chart-4`); a small legend under the chart names both.
- Hover shows the exact UTC time, the direction and the dB value.
- Accessibility follows [`TrendChart`](../stats/TrendChart.md): `role="img"` with an `aria-label` ("SNR with PEER, last 7 days, raw samples: N inbound, M outbound."), `aria-describedby` pointing at the card headline, and a screen-reader table of time, direction and dB. The table lists the latest 200 samples and adds "and K earlier samples" when there are more.
- Busy links can hold hundreds of points at 90 days; the SVG copes and only the table is capped.

## Related

[`LinkSNRCharts`](./LinkSNRCharts.md), [`TrendChart`](../stats/TrendChart.md), [`ChartCard`](../stats/ChartCard.md).
