# TriggerTracerouteModal

## Purpose

Dialog for starting a traceroute: pick a source feeder, then either a target node (manual) or a target strategy (auto).

## Props

- `open`, `onOpenChange`: dialog state.
- `mode`: `'user'` (pick the target) or `'auto'` (strategy picks it); the user can switch inside the dialog unless a target is fixed.
- `managedNodes`: all feeders the caller has; the modal filters them itself.
- `observedNodes`: candidate targets for the pick-target map.
- `onTrigger(managedNodeId, targetNodeId?, targetStrategy?)`: called with a Meshtastic node number.
- `isSubmitting`: disables the submit button.
- `fixedTargetNode`: locks the dialog to user mode with that target; the source is then picked on the map.

## Behaviour

- Only Meshtastic feeders appear, both in the Source node select and as markers on the maps. Traceroutes are triggered by Meshtastic node number, so a MeshCore feeder (an `mc:` id, or `protocol` 2) cannot be a source. The filter is `filterManagedNodesByProtocol(managedNodes, 1)`.
- Map markers also hide feeders that have never fed data.
- Auto mode shows the target-strategy select and a preview map; intra-zone is offered only when the source's geo classification allows it.

## Wiring

Used by `TracerouteHistory`, `nodes/monitor`, `TracerouteStatsPage` and `NodeTracerouteHistorySection`.
