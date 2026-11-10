# NodeShell

## Purpose

The compact, sticky header of a full node page, plus the tab strip and the shared time range. It replaces the old stack of back link, large title, recently-viewed chips and wide tab list, so content starts near the top. Presentational: `NodeDetailContent` decides which tabs exist and what each shows.

## Props

- `shortName`, `longName?`, `hardware?` – identity row. The hardware chip is hidden on phones; the long name truncates.
- `actions?` – claim badge and "Claim Node" / "View Claim" link, placed beside the name.
- `tabs: { value: NodeDetailTab; label }[]`, `activeTab`, `onTabChange` – the tab strip. Test ids stay `node-detail-tab-<value>`; the root keeps `node-detail-tabs`.
- `range?: StatsRange | null` – the page's `useStatsRange()` result. When given, the range bar (`StatsRangeBar`, 24h / 7d / 30d / 90d) shows at the right of the identity row. Pass `null` on tabs that do not use a range.
- `backTo?` – target of the back arrow (default `/nodes`). The arrow has padding for a phone-sized tap target and the accessible name "Back to nodes".
- `children` – the active tab's panel; rendered under the header inside the Radix `Tabs` root.

## Behaviour

- The header is `sticky top-0` with a blurred background, so the tabs and range stay in view while scrolling.
- The range bar sits in the header (not stuck on its own) and offers presets only. There is no Online (2h) here.
- Tabs are Radix triggers, so arrow-key navigation and `role=tab` come with them.

## Wiring

Used by `NodeDetailContent` on the full node page only (never in the slide-over). `NodeDetailContent` shows the bar for the Statistics and Traceroutes tabs (`isRangedNodeDetailTab`) and keeps one `?range=` for both: `useNodeDetailPageTabs` copies existing params on a tab switch, so the range survives. Overview, Map and Monitoring have no range control.

## Related

- [`NodeDetailContent.md`](./NodeDetailContent.md), [`NodeRightNow.md`](./NodeRightNow.md)
- [`../stats/StatsRangeBar.md`](../stats/StatsRangeBar.md), [`../../hooks/useStatsRange.md`](../../hooks/useStatsRange.md)
