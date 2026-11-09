# NodesAndConstellationsMap

## Purpose

The shared Leaflet map for managed (constellation) nodes and observed nodes. Used by Home, the Meshtastic node list, Infrastructure, Managed nodes status, Trigger traceroute and Weather. The MeshCore list uses `NodesMap` instead.

## Props / inputs

- `managedNodes`, `observedNodes`: what to draw. Pages filter by protocol before passing them in.
- `showConstellation`, `filterConstellationIds`: draw constellation-coloured managed pins, optionally limited to some constellations.
- `showMapLegend`, `showRoleLegendSwatches`: control the colour key.
- Marker colour/opacity callbacks, `getNodeAlertRing`, selection and move callbacks.

## Behaviour

- Managed nodes are grouped by constellation (`computeManagedConstellationGroups` in `map-constellation-colors.ts`). Colour is the constellation `map_color`, else `d3.schemeCategory10` by index over the full group set.
- Managed nodes without a position get no pin.
- **The key follows the pins.** `drawnConstellationLegendItems` keeps only constellations with at least one positioned node, so a constellation that is not drawn (no positions, or filtered out by the page) is not in the key. Colours are computed before this filter so pin colours never shift.

## Wiring

`ProtocolNodesPage`, the Home dashboard, and the infrastructure and status pages pass `managedNodes`; the key is rendered by the map legend inside this component.

## Related

- `map-constellation-colors.ts` and its test
