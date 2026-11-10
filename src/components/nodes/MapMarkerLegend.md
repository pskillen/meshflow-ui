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
- **Phones (below the `sm` breakpoint):** the key is closed and a "Map key" button (at least 32px tall) sits in its place. The button always has the same name; `aria-expanded` says whether the panel is open, and `aria-controls` points at it. Escape closes the panel and returns focus to the button. The panel is at most the map width minus 4rem, so it never covers the zoom control at top left, and scrolls inside 85% of the map height.
- **sm and up:** the panel is always shown and the button is hidden, as before (max 40% of the map height).
- The panel is a `role="region"` named "Map key", the same as the button, in both states. The phone/desktop split is CSS only (`hidden sm:block`, `sm:hidden`), so there is no resize listener.

## Wiring

Used by `NodesAndConstellationsMap` and `NodesMap`, which are used on the protocol node lists, the dashboards and the managed-nodes views.

## Related

- [`ProtocolNodesPage`](../../pages/protocol/ProtocolNodesPage.md), `map-role-legend.ts`, `map-constellation-colors.ts`.
- Tests: `MapMarkerLegend.test.tsx`, `tests/browser/nodes-list.spec.ts`.
