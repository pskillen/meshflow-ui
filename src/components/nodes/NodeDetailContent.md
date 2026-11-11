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
- Statistics: `NodeStatsSection` gets the range; the battery, channel and air, environment and power charts take `range` directly and ask the API for the bucket that matches it. The packet charts ([`NodePacketTypeCard`](./NodePacketTypeCard.md)) and "Heard most from" ([`NeighbourSourceBars`](./NeighbourSourceBars.md)) take `range` too. Traceroutes: tiles (Links, Traceroutes, Best SNR; Traceroutes is the count of traceroutes to this node in the range, the same request and `count` as the history table), the links map and the per-link SNR cards ([`LinkSNRCharts`](./LinkSNRCharts.md)) use `range` (`window.start` is the API's `triggered_at_after`); the history table (`NodeTracerouteHistorySection`) sends `triggered_after` from the same window start. The map's contents and the outgoing-traceroutes section are unchanged.
- **Right now** ([`NodeRightNow`](./NodeRightNow.md)) tops Overview and Statistics.
- **Identity banner** ([`NodeIdentityBanner`](./NodeIdentityBanner.md)) sits above the tab content on the full page (every tab), and at the top of the non-tab/slide-over layout, where it is one line. It renders nothing when the API sends no `replaced_by` / `identity_chain`.
- **Identity review** ([`NodeIdentityLinksSection`](./NodeIdentityLinksSection.md)) sits at the top of Overview, for the node's owner and staff only (not MeshCore). It lists the node's links with Confirm / "Not the same radio" and holds the "Declare a replacement" dialog. Guests and other users get nothing and no request.
- **Inferred Max Hops** (Overview, when the API sends it) is a best guess from recent packets, not a setting the node reported. Meshtastic 2.8 nodes can vary their hop limit per packet, so the value may change; the sub-line says so and gives the recommended 7. The page does not show when or from which packet it was inferred.
- Recently viewed chips sit at the bottom of the page; the back link is the arrow in the header.
- The Device Metrics card is gone from Overview: [`NodeRightNow`](./NodeRightNow.md) carries the latest battery, channel use, air time and uptime, and the history is under Statistics.

## Wiring

`src/pages/nodes/NodeDetails.tsx`, `NodeDetailSheet.tsx`. Hooks: `useNodeSuspense`, `useManagedNodesSuspense`, `useStatsRange`, `useNodeTracerouteLinks`.

## Related

[`NodeShell.md`](./NodeShell.md), [`NodeIdentityBanner.md`](./NodeIdentityBanner.md), [`NodeIdentityLinksSection.md`](./NodeIdentityLinksSection.md), [`NodeRightNow.md`](./NodeRightNow.md), [`../../hooks/useStatsRange.md`](../../hooks/useStatsRange.md), `src/pages/nodes/useNodeDetailPageTabs.ts`.
