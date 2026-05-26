/** Stats snapshot stat_type values from GET /api/stats/snapshots/ */

export type MeshtasticSnapshotStatType = 'online_nodes' | 'new_nodes' | 'packet_volume';
export type MeshcoreSnapshotStatType = 'mc_online_nodes' | 'mc_new_nodes' | 'mc_packet_volume';
export type StatsSnapshotStatType = MeshtasticSnapshotStatType | MeshcoreSnapshotStatType;

export type MeshStatsProtocolScope = 'meshtastic' | 'meshcore' | 'both';

export type OnlineNodesChartMetric = 'online_nodes' | 'new_nodes';

export function packetVolumeStatTypes(scope: MeshStatsProtocolScope): StatsSnapshotStatType[] {
  if (scope === 'meshtastic') return ['packet_volume'];
  if (scope === 'meshcore') return ['mc_packet_volume'];
  return ['packet_volume', 'mc_packet_volume'];
}

export function onlineNodesMetricStatTypes(
  metric: OnlineNodesChartMetric,
  scope: MeshStatsProtocolScope
): StatsSnapshotStatType[] {
  const mt: MeshtasticSnapshotStatType = metric;
  const mc: MeshcoreSnapshotStatType = metric === 'online_nodes' ? 'mc_online_nodes' : 'mc_new_nodes';
  if (scope === 'meshtastic') return [mt];
  if (scope === 'meshcore') return [mc];
  return [mt, mc];
}

export const MC_PACKET_TYPE_DISPLAY_NAMES: Record<string, string> = {
  advert: 'Advert',
  channel_text: 'Channel text',
  contact_text: 'Contact text',
  raw: 'Raw',
};
