import type { ManagedNode, ObservedNode } from '@/lib/models';
import { getRoleLabel } from '@/lib/meshtastic';

export interface InfrastructureExportRow {
  internal_id: string;
  node_id_str: string;
  short_name: string;
  long_name: string;
  role_label: string;
  hw_model: string;
  last_heard_iso: string;
  latitude: string;
  longitude: string;
  altitude: string;
  battery_percent: string;
  channel_util_percent: string;
  owner_username: string;
  is_managed_feeder: boolean;
  constellation_name: string;
  is_licensed: boolean | null;
  has_rf_profile: boolean;
  has_ready_rf_render: boolean;
}

function formatCoord(value: number | null | undefined): string {
  if (value == null || value === 0) return '';
  return String(value);
}

function formatIso(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatMetric(value: number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

export function buildInfrastructureExportRow(
  node: ObservedNode,
  managedNode?: ManagedNode | null
): InfrastructureExportRow {
  const pos = node.latest_position;
  const metrics = node.latest_device_metrics;

  return {
    internal_id: node.internal_id,
    node_id_str: node.node_id_str ?? '',
    short_name: node.short_name ?? '',
    long_name: node.long_name ?? '',
    role_label: getRoleLabel(node.meshtastic_role) ?? '',
    hw_model: node.meshtastic_hw_model ?? '',
    last_heard_iso: formatIso(node.last_heard),
    latitude: formatCoord(pos?.latitude),
    longitude: formatCoord(pos?.longitude),
    altitude: formatMetric(pos?.altitude),
    battery_percent: formatMetric(metrics?.battery_level),
    channel_util_percent: formatMetric(metrics?.meshtastic_channel_utilization),
    owner_username: node.owner?.username ?? '',
    is_managed_feeder: managedNode != null,
    constellation_name: managedNode?.constellation?.name ?? '',
    is_licensed: node.meshtastic_is_licensed ?? null,
    has_rf_profile: node.has_rf_profile ?? false,
    has_ready_rf_render: node.has_ready_rf_render ?? false,
  };
}

export function buildInfrastructureExportRows(
  nodes: ObservedNode[],
  managedByMeshId: Map<number, ManagedNode>
): InfrastructureExportRow[] {
  return nodes.map((node) => buildInfrastructureExportRow(node, managedByMeshId.get(node.meshtastic_node_id)));
}
