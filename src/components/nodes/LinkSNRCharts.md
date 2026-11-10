# LinkSNRCharts

## Purpose

SNR per link on the node Traceroutes tab: one [`MetricTrendCard`](./MetricTrendCard.md) per peer, inbound and outbound on the same chart, on the page's shared range window.

## Props

- `snrHistory: NodeTracerouteLinkSnrHistory[]` – from `useNodeTracerouteLinks` (raw per-traceroute samples).
- `range: StatsRange` – the page's range: fixes the x axis and the bucket size.
- `initialVisible?` – links shown before "Show all links (N more)" (default 4).

## Behaviour

- Samples are averaged per UTC bucket of `range.bucket` (`bucketLinkSnr` in `src/lib/node-traceroute-snr.ts`); a bucket with no sample is a gap, so dots are drawn on every point. Samples up to the end of the bucket in progress count (the window `end` is the top of the hour, but traceroutes keep arriving); that bucket is drawn dashed.
- Headline is the mean of the bucket values drawn, per direction ("avg in -8.8 / out 3.5 dB"), so it matches the chart. A link with no samples in the range shows an empty message, not a headline.
- Y axis is fixed at -20 to 10 dB on every card so links compare. Outbound is dashed as well as a different colour.
- Links are ordered most-traced first, then most recent. The old "By direction" and "Combined" tabs are gone; the Traceroutes tab shows per-link cards only.

## Wiring

`TracerouteLinksSection` in [`NodeDetailContent`](./NodeDetailContent.md), under the links map, below the Links / Peers / Best SNR tiles (Best SNR is the best edge average in either direction).

## Related

[`MetricTrendCard`](./MetricTrendCard.md), [`TrendChart`](../stats/TrendChart.md), `NodeTracerouteHistorySection` (the history table, filtered to the same range).
