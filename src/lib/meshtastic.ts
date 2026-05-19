/**
 * Meshtastic role IDs and labels.
 * @see https://meshtastic.org/docs/development/protobufs/api/#radioconfig-userpreferences
 */
/**
 * Integer role values that may be watched by any authenticated user (shared infrastructure).
 * Keep in sync with meshflow-api `nodes.constants.INFRASTRUCTURE_ROLES` / `RoleSource`.
 */
export const INFRASTRUCTURE_ROLE_IDS: ReadonlySet<number> = new Set([2, 3, 4, 11]); // ROUTER, ROUTER_CLIENT, REPEATER, ROUTER_LATE

/** Matches mesh monitoring `user_can_watch` for UI gating (claim owner or infra role). */
export function userCanMeshWatchNode(
  node: { meshtastic_role?: number | null; owner?: { id: number } | null },
  currentUserId: number | null | undefined
): boolean {
  if (currentUserId == null) return false;
  if (node.owner?.id === currentUserId) return true;
  if (node.meshtastic_role != null && INFRASTRUCTURE_ROLE_IDS.has(node.meshtastic_role)) return true;
  return false;
}

export const ROLE_LABELS: Record<number, string> = {
  0: 'CLIENT',
  1: 'CLIENT_MUTE',
  2: 'ROUTER',
  3: 'ROUTER_CLIENT',
  4: 'REPEATER',
  5: 'TRACKER',
  6: 'SENSOR',
  7: 'TAK',
  8: 'CLIENT_HIDDEN',
  9: 'LOST_AND_FOUND',
  10: 'TAK_TRACKER',
  11: 'ROUTER_LATE',
  12: 'CLIENT_BASE',
};

export function getRoleLabel(role: number | null | undefined): string | null {
  if (role == null) return null;
  return ROLE_LABELS[role] ?? `Role ${role}`;
}
