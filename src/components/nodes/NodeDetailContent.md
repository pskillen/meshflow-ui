# NodeDetailContent

## Purpose

The body of a node page. It is used in two ways:

- **Full page** (`NodeDetails`, with `activeTab` and `onTabChange` from `useNodeDetailPageTabs`): a sticky header ([`NodeShell`](./NodeShell.md)) with tabs and the shared range, then the active tab's panel.
- **Compact** (`NodeDetailSheet`, the slide-over on list pages): the old single-column summary with a "View full details" link. No tabs, no range bar.

## Props

`internalId`, `compact?`, `activeTab?`, `onTabChange?`.

## Behaviour

- Tabs: Overview, Map, Traceroutes (Meshtastic only), Statistics, Monitoring (signed in, not MeshCore). A tab that does not apply falls back to Overview.
- **Shared range.** One `useStatsRange` per page (no `area`, so a different node never inherits it; presets only). It lives in `?range=` on the full page, and in component state when compact so the host page's URL is never touched. The bar shows on Statistics and Traceroutes only; switching between them keeps the range.
- Statistics: `NodeStatsSection` gets the range; the battery, channel and air, environment and power charts take `range` directly and ask the API for the bucket that matches it. The packet charts ([`NodePacketTypeCard`](./NodePacketTypeCard.md)) and "Heard most from" ([`NeighbourSourceBars`](./NeighbourSourceBars.md)) take `range` too. Traceroutes: the links section uses `range.window.start` for the API call and the SNR chart axis.
- **Right now** ([`NodeRightNow`](./NodeRightNow.md)) tops Overview and Statistics.
- Recently viewed chips sit at the bottom of the page; the back link is the arrow in the header.
- The Device Metrics card is gone from Overview: [`NodeRightNow`](./NodeRightNow.md) carries the latest battery, channel use, air time and uptime, and the history is under Statistics.

## Wiring

`src/pages/nodes/NodeDetails.tsx`, `NodeDetailSheet.tsx`. Hooks: `useNodeSuspense`, `useManagedNodesSuspense`, `useStatsRange`, `useNodeTracerouteLinks`.

## Related

[`NodeShell.md`](./NodeShell.md), [`NodeRightNow.md`](./NodeRightNow.md), [`../../hooks/useStatsRange.md`](../../hooks/useStatsRange.md), `src/pages/nodes/useNodeDetailPageTabs.ts`.
