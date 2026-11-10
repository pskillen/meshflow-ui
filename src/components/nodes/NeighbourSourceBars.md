# NeighbourSourceBars

## Purpose

"Heard most from": which neighbours a managed node received the most packets from over the page's range, as ranked horizontal bars. It replaces the old source pie, which was hard to compare past three slices.

## Props

`nodeId`, `range: StatsRange`.

## Behaviour

- Queries `/stats/nodes/<id>/neighbours/` for the range window, ending one hour past `window.end`.
- Sorted by packet count, largest first and full width; the others are scaled to it. The top 10 are drawn and the rest summed in "and N more, X packets".
- A row's label is the short name, or "LSB n" when a last byte matches several nodes (with the candidates linked under the bar), or the node id with no name. A "Why some sources are LSB" note explains the last byte.
- One colour (`--chart-1`): rank is the information, so there is no legend.
- Loading, error and empty states are text in the card.
- Managed nodes only, and still behind a "click to load" button in `NodeStatsSection`, because the query is expensive.

## Wiring

`NeighbourStatsWithLoad` in `NodeStatsSection`.

## Related

[`NodePacketTypeCard`](./NodePacketTypeCard.md), [`ChartCard`](../stats/ChartCard.md), `useNeighbourStats` in `src/hooks/api/usePacketStats.ts`.
