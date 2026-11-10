# LinkSNRCharts

## Purpose

SNR per link on the node Traceroutes tab: one card per peer, inbound and outbound on the same chart, on the page's shared range window. A Means / Raw toggle switches every card between bucket means ([`MetricTrendCard`](./MetricTrendCard.md)) and every sample ([`SnrPointsChart`](./SnrPointsChart.md)).

## Props

- `snrHistory: NodeTracerouteLinkSnrHistory[]` – from `useNodeTracerouteLinks` (raw per-traceroute samples).
- `range: StatsRange` – the page's range: fixes the x axis and the bucket size.
- `initialVisible?` – links shown before "Show all links (N more)" (default 4).

## Behaviour

- Samples are averaged per UTC bucket of `range.bucket` (`bucketLinkSnr` in `src/lib/node-traceroute-snr.ts`); a bucket with no sample is a gap, so dots are drawn on every point. When a 6-hour or daily bucket is in progress (`partialEnd`) samples count up to its end and it is drawn dashed, with a dot, so a lone sample shows; otherwise samples at or after the window `end` are off the grid and are not counted, so the headline is always the mean of what is drawn. The y axis is fixed at -20 to 10 dB with a tick every 10 on every card; a value outside it is clipped to the plot and the card notes "N points off the scale".
- Headline is the mean of the bucket values drawn, per direction ("avg in -8.8 / out 3.5 dB"), so it matches the chart. A link with no samples in the range shows an empty message, not a headline.
- Y axis is fixed at -20 to 10 dB on every card so links compare. Outbound is dashed as well as a different colour.
- **Means / Raw** toggle (`ToggleGroup`, "SNR view") beside the "SNR over time by link" heading drives every card. Local state, defaults to Means, not remembered. In Raw each traceroute sample is a dot at its own time, at every range and on phones: inbound filled circle, outbound hollow triangle, so direction is not told by colour alone. Raw keeps the Means window bounds (`rawLinkSnr` shares `snrWindowEndMs` with `bucketLinkSnr`), so both views show the same samples. The Raw headline is the mean of the raw samples per direction, and the off-scale note counts raw samples. The measure pill reads "Each dot: one traceroute's SNR in dB".
- Links are ordered most-traced first, then most recent. The old "By direction" and "Combined" tabs are gone; the Traceroutes tab shows per-link cards only.

## Wiring

`TracerouteLinksSection` in [`NodeDetailContent`](./NodeDetailContent.md), under the links map, below the Links / Traceroutes / Best SNR tiles (Best SNR is the best edge average in either direction).

## Related

[`MetricTrendCard`](./MetricTrendCard.md), [`TrendChart`](../stats/TrendChart.md), `NodeTracerouteHistorySection` (the history table, filtered to the same range).
