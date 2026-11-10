# NodesTable

## Purpose

The "Recent Nodes" table on the node list pages. One component for both protocols, replacing the card grid, the sort toggle and the MeshCore "Identity only" section.

## Props / inputs

- `nodes: ObservedNode[]` – already filtered by the page (search); the table only sorts.
- `config: ProtocolPageConfig` – picks the columns (`slug`) and the row link (`routes.nodeDetail`).
- `emptyMessage?` – shown in a single row when `nodes` is empty.

## Behaviour

- **Meshtastic columns**: Node, ID, Role, Hardware, Battery, Last heard. **MeshCore**: Node, ID, Prefix, Position (Known / None), Last heard.
- **Node** is the primary label (short name, with the long name beneath); the ID is supporting detail. The Node cell links to the node page.
- **Phones** show Node, Battery (Meshtastic) or Position (MeshCore), and Last heard. ID and Role show from `md`, Hardware from `lg`.
- **Sorting**: every header is a button; the active one has `aria-sort` and an arrow. Default Last heard, newest first. A first click starts A to Z on text columns and largest or latest first on Battery, Position and Last heard; a second click reverses. Sorting is client side over the loaded pages. A missing value (no battery reading, no last heard) sorts after every present value in either direction.
- **Battery** uses `describeBattery`: raw 101 shows "Powered" (ranks above 100%), 0 is a real "0%" (red), no reading is a dash.

## Wiring

Used by [`ProtocolNodesPage`](../../pages/protocol/ProtocolNodesPage.md). Sorting is local state in the table; the sort function is a pure helper in the same file. `NodeCard` stays for other pages that still use it.

## Related

- `src/lib/battery.ts`, `src/lib/mesh-protocol.ts`.
- Tests: `NodesTable.test.tsx`.
