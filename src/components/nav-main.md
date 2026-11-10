# NavMain

Sidebar navigation (`nav-main.tsx`): protocol sections (Meshtastic, MeshCore) with child links, plus unread-message badges.

## Mesh infra badge

- Each protocol's **Nodes → Mesh infra** child shows an amber badge with that protocol's alerting infra node count (99+ capped).
- The badge is keyed on the child URL, not its title: `/nodes/infrastructure` is Meshtastic, `/meshcore/infrastructure` is MeshCore (`INFRA_BADGE_PROTOCOL_BY_URL`).
- Data: `useMeshInfraMonitoringAlertsSummary(protocol, enabled)` calls `GET /api/monitoring/alerts/summary/?scope=mesh_infra&protocol=meshtastic|meshcore` (meshflow-api#526). The query key is `['monitoring','alerts-summary','mesh_infra', protocol]`, so invalidating `meshInfraAlertsSummaryKey` refreshes both.
- `supported: false` (MeshCore today: presence monitoring does not run for MC nodes) hides the badge. Older APIs omit `supported`: treated as true for Meshtastic, false for MeshCore.
- Zero count hides the badge.

## Related

- `src/hooks/api/useNodeWatches.ts`, `src/pages/nodes/MeshInfrastructure.tsx`
