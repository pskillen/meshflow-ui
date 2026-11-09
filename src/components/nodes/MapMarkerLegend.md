# MapMarkerLegend

## Purpose

The colour key drawn over a map: constellation colours, optional watch-status colours, and role colours for other nodes. Shared by `NodesAndConstellationsMap` and `NodesMap`.

## Props

- `constellationItems`, `constellationTitle` – monitoring (constellation) swatches.
- `statusSwatches`, `statusSectionTitle` – optional watch-status swatches.
- `showRoleSwatches`, `roleSwatches`, `roleSectionTitle` – role colours.
- `className` – merged onto the outer positioned wrapper.

It renders nothing when no section has content.

## Behaviour

- Positioned top-right inside the map container (`z-10`, below sheets and dialogs).
- **Phones (below the `sm` breakpoint):** the key is closed and a "Map key" button sits in its place; the button toggles the panel ("Hide key" when open, `aria-expanded` and `aria-controls` set). The panel scrolls inside 85% of the map height.
- **sm and up:** the panel is always shown and the button is hidden, as before (max 40% of the map height).
- The panel keeps `role="region"` with the label "Map marker colours" in both states. The phone/desktop split is CSS only (`hidden sm:block`, `sm:hidden`), so there is no resize listener.

## Wiring

Used by `NodesAndConstellationsMap` and `NodesMap`, which are used on the protocol node lists, the dashboards and the managed-nodes views.

## Related

- [`ProtocolNodesPage`](../../pages/protocol/ProtocolNodesPage.md), `map-role-legend.ts`, `map-constellation-colors.ts`.
- Tests: `MapMarkerLegend.test.tsx`, `tests/browser/nodes-list.spec.ts`.
