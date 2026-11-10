# Dashboard (Home)

## Purpose

The signed-out landing page: a quick read of the whole mesh (Meshtastic and MeshCore together), then the map of nodes that report into Meshflow.

## Behaviour

Top to bottom:

1. `StatsRangeBar` (the dashboards' range, shared with the Meshtastic and MeshCore dashboards).
2. `RightNowBand`: fixed windows, live, not affected by the range.
3. `MeshStatsSection`: the range charts (Online nodes, New nodes, Packet volume).
4. The Meshflow Map card (`NodesAndConstellationsMap`, unchanged). It sits last so the stats are not pushed below the fold.

On phones (below the `md` breakpoint) the map is collapsed: only the card title and a Show map / Hide map button show, and the map is not mounted (no tiles load) until opened. The choice is not remembered. On wider screens the map is always shown and there is no button.

## Wiring

Route `/` (`src/App.tsx`). Uses `useManagedNodesSuspense` for the map's pins and `useStatsRange({ area: DASHBOARDS_AREA })` for the range.

## Related

- `src/components/stats/StatsRangeBar.md`, `RightNowBand.md`, `src/components/MeshStatsSection.md`
- Browser tests: `tests/browser/dashboard.spec.ts`
