import type { NodeWatch } from '@/lib/models';

/** Mesh monitoring status for a watched node (UI + map + sorting). */
export type WatchMonitoringStatus = 'offline' | 'verifying' | 'battery_low' | 'unknown' | 'online';

/** Sort rank: lower = show first. */
export const WATCH_STATUS_SORT_RANK: Record<WatchMonitoringStatus, number> = {
  offline: 0,
  verifying: 1,
  battery_low: 2,
  unknown: 3,
  online: 4,
};

export const WATCH_STATUS_MAP_COLOR: Record<WatchMonitoringStatus, string> = {
  offline: '#dc2626',
  verifying: '#d97706',
  battery_low: '#b45309',
  unknown: '#64748b',
  online: '#16a34a',
};

export const WATCH_STATUS_LABEL: Record<WatchMonitoringStatus, string> = {
  offline: 'Offline',
  verifying: 'Verifying',
  battery_low: 'Low battery',
  unknown: 'Unknown / stale',
  online: 'Online',
};

function toTimeMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Derive monitoring status for a watch using API hints and last_heard vs silence threshold.
 *
 * Precedence: offline confirmed > verifying > active battery alert > online (heard within threshold) > unknown.
 */
export function deriveWatchMonitoringStatus(watch: NodeWatch, nowMs: number = Date.now()): WatchMonitoringStatus {
  const n = watch.observed_node;
  if (n.monitoring_offline_confirmed_at) {
    return 'offline';
  }
  if (n.monitoring_verification_started_at) {
    return 'verifying';
  }
  if (n.battery_alert_active) {
    return 'battery_low';
  }

  const offlineAfterSec = watch.offline_after ?? n.offline_after;
  const lastHeardMs = toTimeMs(n.last_heard);

  if (lastHeardMs == null) {
    return 'unknown';
  }
  if (offlineAfterSec == null || offlineAfterSec <= 0) {
    return 'unknown';
  }

  const ageSec = (nowMs - lastHeardMs) / 1000;
  if (ageSec <= offlineAfterSec) {
    return 'online';
  }
  return 'unknown';
}

/** Stable sort: status rank, then last heard ascending (stale first), then meshtastic_node_id. */
export function compareWatchesByMonitoringStatus(a: NodeWatch, b: NodeWatch, nowMs?: number): number {
  const t = nowMs ?? Date.now();
  const sa = deriveWatchMonitoringStatus(a, t);
  const sb = deriveWatchMonitoringStatus(b, t);
  const ra = WATCH_STATUS_SORT_RANK[sa];
  const rb = WATCH_STATUS_SORT_RANK[sb];
  if (ra !== rb) return ra - rb;

  const la = toTimeMs(a.observed_node.last_heard);
  const lb = toTimeMs(b.observed_node.last_heard);
  if (la != null && lb != null && la !== lb) return la - lb;
  if (la == null && lb != null) return 1;
  if (la != null && lb == null) return -1;

  return a.observed_node.meshtastic_node_id - b.observed_node.meshtastic_node_id;
}

export function sortWatchesByMonitoringStatus(watches: NodeWatch[], nowMs?: number): NodeWatch[] {
  const t = nowMs ?? Date.now();
  return [...watches].sort((a, b) => compareWatchesByMonitoringStatus(a, b, t));
}

export function countWatchesByMonitoringStatus(
  watches: NodeWatch[],
  nowMs?: number
): Record<WatchMonitoringStatus, number> {
  const t = nowMs ?? Date.now();
  const counts: Record<WatchMonitoringStatus, number> = {
    offline: 0,
    verifying: 0,
    battery_low: 0,
    unknown: 0,
    online: 0,
  };
  for (const w of watches) {
    counts[deriveWatchMonitoringStatus(w, t)] += 1;
  }
  return counts;
}

/** Legend rows for map (same shape as role swatches). */
export function watchMonitoringStatusLegendSwatches(): { key: string; label: string; color: string }[] {
  return (Object.keys(WATCH_STATUS_LABEL) as WatchMonitoringStatus[]).map((status) => ({
    key: `watch-status-${status}`,
    label: WATCH_STATUS_LABEL[status],
    color: WATCH_STATUS_MAP_COLOR[status],
  }));
}
