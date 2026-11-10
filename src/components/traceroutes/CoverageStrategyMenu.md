# CoverageStrategyMenu

## Purpose

The target-selection strategy filter on the two coverage pages, collapsed to a single "Strategies: All" button so the map keeps the page. It replaces the always-open row of four checkboxes.

## Props

- `value: Record<string, boolean>` – one flag per strategy; every strategy ticked is the default (`createCoverageStrategiesAllSelected()`).
- `onChange(next)` – receives the full updated record.
- `className?`.

## Behaviour

- The button reads `Strategies: All`, `None`, the single chosen strategy's label, or `n of 4`.
- Opens a checkbox menu (Intra-zone, DX across, DX same side, Legacy). The menu stays open while ticking so several can be changed at once.
- Filtering itself is unchanged: `coverageTargetStrategyQueryParam` omits the API param when all or none are ticked.

## Wiring

`FeederCoveragePage` and `ConstellationCoveragePage`, in the second toolbar row beside the layer pills. The heatmap and topology pages have their own strategy menu in `TracerouteHeatmapChrome`.

## Related

`src/lib/traceroute-strategy.ts`.
