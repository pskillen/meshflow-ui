# NodesAndConstellationsMap

## Purpose

The shared Leaflet map for managed (constellation) nodes and observed nodes. Constellation maps that use it: Home, the Meshtastic node list, Infrastructure, Managed nodes status and Trigger traceroute. `WeatherNodesMap` also renders it, but only for observed weather nodes (no managed nodes, no constellations, no key). The MeshCore node list uses `NodesMap` instead, which has a role key and never a constellation key.

## Props / inputs

- `managedNodes`, `observedNodes`: what to draw. The component does not filter by protocol; each page decides what to pass (see Wiring).
- `showConstellation`, `filterConstellationIds`: draw constellation-coloured managed pins, optionally limited to some constellations. With `showConstellation={false}` there are no managed pins and no constellation key.
- `showMapLegend`, `showRoleLegendSwatches`: control the colour key. When `showMapLegend` is unset the key is hidden if `getMarkerColor` or `getManagedNodeMarkerColor` is set, because pin colours then mean something other than constellation.
- Marker colour/opacity callbacks, `getNodeAlertRing`, selection and move callbacks.

## Behaviour

- Managed nodes are grouped by constellation (`computeManagedConstellationGroups` in `map-constellation-colors.ts`). Colour is the constellation `map_color`, else `d3.schemeCategory10` by index over the full group set.
- Managed nodes without a position get no pin. `hasMapPosition` is the single "has both coordinates" test, used by the pin, bounding-box and radius-circle drawing and by the key.
- **The key follows the pins.** `drawnConstellationLegendItems` keeps only constellations with at least one positioned node, so a constellation that is not drawn (no positions, or filtered out by the page) is not in the key. Colours are computed before this filter so pin colours never shift.

## Wiring

Which pages filter feeders by protocol before passing `managedNodes`, using `filterManagedNodesByProtocol` (`src/lib/mesh-protocol.ts`, which treats an `mc:` id as MeshCore even when `protocol` is missing):

- `ProtocolNodesPage` (Meshtastic list): Meshtastic feeders only, then never-fed feeders dropped.
- `MeshInfrastructure`: feeders of the page's protocol, then never-fed dropped.
- `ManagedNodesStatus` (Meshtastic loader): Meshtastic feeders only. Pins use status colours, so the key is hidden by default.

Pages that pass feeders of every protocol (never-fed dropped), so their key lists the drawn constellations of both:

- `Dashboard` (Home).
- `TriggerTracerouteModal` (passes through the `managedNodes` it is given).

## Related

- `map-constellation-colors.ts` and its test
- `MapMarkerLegend.tsx` (the key)
- `NodesMap.tsx` (key without constellations, used by the MeshCore list)
- `WeatherNodesMap.tsx`
- `src/pages/protocol/ProtocolNodesPage.test.tsx` (protocol mix, key and pins)
