# NodePacketTypeCard

## Purpose

Packets one node sent ("Sent packets") or heard ("Heard packets", managed nodes only) over the page's shared range, as stacked bars by packet type. One bar per range bucket, so the count follows the range instead of always being hourly.

## Props

`nodeId` (the Meshtastic node id), `range: StatsRange` (from `useStatsRange`), `direction: 'sent' | 'received'`. [`PacketTypeChart`](../PacketTypeChart.tsx) and [`ReceivedPacketTypeChart`](../ReceivedPacketTypeChart.tsx) are one-line wrappers for the two directions.

## Behaviour

- **Query:** `interval=1` always. 24h and 7d ask for `hour` intervals, 30d and 90d for `day` (`packetIntervalType`). It never sends `interval > 1`: the server's `interval=6` leaves the buckets hourly while each claims a 6-hour end (raised as a follow-up). The end is one hour past `window.end` (`metricQueryEnd`), so the newest hour is included.
- **Roll-up:** `buildPacketTypeRows` (`src/lib/node-packet-series.ts`) folds the hourly rows into 6-hour buckets at 7d by each interval's start. The bucket in progress is marked partial (faded, dashed).
- **Bars:** at most 24 at 24h, 29 at 7d (28 whole buckets, one more when the window starts mid-bucket), 31 at 30d, 91 at 90d. A test asserts these.
- **Colours:** the long-standing per-type colours (hex, not chart tokens): text message blue, position green, device metrics amber, node info violet, local stats pink, environment metrics red, other grey. A type the list does not know adds to Other.
- Headline is the total for the range; an empty range shows a plain-words placeholder. A screen-reader table and name come from [`TrendChart`](../stats/TrendChart.md).

## Wiring

`NodeStatsSection`, below the metric cards, inside a `Suspense`. The query key includes the interval and its type, so hourly and daily answers never share a cache entry.

## Related

[`TrendChart`](../stats/TrendChart.md), [`ChartCard`](../stats/ChartCard.md), [`NeighbourSourceBars`](./NeighbourSourceBars.md), `src/hooks/api/usePacketStats.ts`.
