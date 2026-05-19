import { subDays } from 'date-fns';
import type { ObservedNode } from '@/lib/models';

/** Battery reading older than this is treated as stale (separate from GPS freshness). */
export const STALE_BATTERY_TELEMETRY_DAYS = 3;

/** Below this percentage (inclusive of 0) counts as “low battery” when telemetry exists. */
export const LOW_BATTERY_THRESHOLD_PERCENT = 50;

export function getBatteryMetricsReportedAt(node: ObservedNode): Date | null {
  const m = node.latest_device_metrics;
  if (!m?.reported_time) return null;
  const t = m.reported_time;
  return t instanceof Date ? t : new Date(t);
}

export function isBatteryTelemetryStale(node: ObservedNode, now: Date = new Date()): boolean {
  const at = getBatteryMetricsReportedAt(node);
  if (!at) return true;
  return at < subDays(now, STALE_BATTERY_TELEMETRY_DAYS);
}

/** True if the node should appear in the low-battery section (union of low % and stale / missing telemetry). */
export function qualifiesLowBatterySection(node: ObservedNode, now: Date = new Date()): boolean {
  const m = node.latest_device_metrics;
  if (!m) return true;
  if (isBatteryTelemetryStale(node, now)) return true;
  return m.battery_level < LOW_BATTERY_THRESHOLD_PERCENT;
}

export type LowBatteryRowFlags = {
  /** Shown in the muted bottom group; telemetry often bogus at 0%. */
  isZeroPercent: boolean;
  showLowBatteryBadge: boolean;
  showStaleBatteryBadge: boolean;
};

export function getLowBatteryRowFlags(node: ObservedNode, now: Date = new Date()): LowBatteryRowFlags {
  const m = node.latest_device_metrics;
  const reportedAt = getBatteryMetricsReportedAt(node);
  const hasUsableMetrics = Boolean(m && reportedAt);
  const level = m?.battery_level;
  const isZeroPercent = hasUsableMetrics && level === 0;
  const showStaleBatteryBadge = !hasUsableMetrics || isBatteryTelemetryStale(node, now);
  const showLowBatteryBadge = hasUsableMetrics && level != null && level < LOW_BATTERY_THRESHOLD_PERCENT;
  return { isZeroPercent, showLowBatteryBadge, showStaleBatteryBadge };
}

/** Row matches the “no battery telemetry” bucket (no device metrics or no reported_time). */
export function matchesLowBatteryNoTelemetryRow(node: ObservedNode): boolean {
  const m = node.latest_device_metrics;
  const reportedAt = getBatteryMetricsReportedAt(node);
  return !(m && reportedAt);
}

/** Row matches the “always 0%” bucket (usable metrics, level 0). */
export function matchesLowBatteryZeroPercentRow(node: ObservedNode, now: Date = new Date()): boolean {
  return getLowBatteryRowFlags(node, now).isZeroPercent;
}

/** Row matches the “stale reading” bucket (usable telemetry older than STALE_BATTERY_TELEMETRY_DAYS). */
export function matchesLowBatteryStaleReadingRow(node: ObservedNode, now: Date = new Date()): boolean {
  if (matchesLowBatteryNoTelemetryRow(node)) return false;
  return isBatteryTelemetryStale(node, now);
}

export type LowBatteryTableFilters = {
  showStaleReadings: boolean;
  showZeroPercent: boolean;
  showNoTelemetry: boolean;
};

/**
 * Whether a low-battery table row should be shown given pill filters (all default off = hide that bucket).
 * Rows matching multiple buckets are hidden if any of those buckets is filtered off.
 */
export function isLowBatteryTableRowVisible(
  node: ObservedNode,
  filters: LowBatteryTableFilters,
  now: Date = new Date()
): boolean {
  if (matchesLowBatteryNoTelemetryRow(node) && !filters.showNoTelemetry) return false;
  if (matchesLowBatteryZeroPercentRow(node, now) && !filters.showZeroPercent) return false;
  if (matchesLowBatteryStaleReadingRow(node, now) && !filters.showStaleReadings) return false;
  return true;
}

/**
 * Map pin alert halo on Mesh Infra: offline, mesh battery alert, missing battery telemetry, 0%, or low %.
 * Does **not** treat “reading is old but % still looks fine” as an alert (stale-only).
 */
export function hasMeshInfraMapBatteryOrPresenceAlert(node: ObservedNode, now: Date = new Date()): boolean {
  const cutoff = subDays(now, 7);
  const lastHeard = node.last_heard
    ? node.last_heard instanceof Date
      ? node.last_heard
      : new Date(node.last_heard)
    : null;
  const isOffline = !lastHeard || lastHeard < cutoff;
  if (isOffline) return true;
  if (node.battery_alert_active) return true;

  const m = node.latest_device_metrics;
  const reportedAt = getBatteryMetricsReportedAt(node);
  const hasUsableMetrics = Boolean(m && reportedAt);
  if (!hasUsableMetrics) return true;

  const level = m!.battery_level;
  if (level === 0) return true;
  if (level != null && level < LOW_BATTERY_THRESHOLD_PERCENT) return true;

  return false;
}

function lastHeardTime(node: ObservedNode): number {
  if (!node.last_heard) return 0;
  return node.last_heard instanceof Date ? node.last_heard.getTime() : new Date(node.last_heard).getTime();
}

/**
 * Infrastructure “low battery” table: heuristic low/stale rows **plus** nodes with an active mesh
 * monitoring battery alert from the API (`battery_alert_active`), even when telemetry looks fine.
 */
export function partitionMeshInfraLowBatteryTableNodes(nodes: ObservedNode[], now: Date = new Date()): ObservedNode[] {
  const base = partitionLowBatteryNodes(nodes, now);
  const inBase = new Set(base.map((n) => n.meshtastic_node_id));
  const additions: ObservedNode[] = [];
  for (const n of nodes) {
    if (inBase.has(n.meshtastic_node_id)) continue;
    if (n.battery_alert_active) additions.push(n);
  }
  additions.sort((a, b) => lastHeardTime(b) - lastHeardTime(a));
  return [...additions, ...base];
}

/**
 * Deduplicates by node id, partitions 0% rows to the bottom, sorts by most recently heard within each group.
 */
export function partitionLowBatteryNodes(nodes: ObservedNode[], now: Date = new Date()): ObservedNode[] {
  const seen = new Set<number>();
  const candidates: ObservedNode[] = [];
  for (const n of nodes) {
    if (seen.has(n.meshtastic_node_id)) continue;
    if (!qualifiesLowBatterySection(n, now)) continue;
    seen.add(n.meshtastic_node_id);
    candidates.push(n);
  }

  const primary: ObservedNode[] = [];
  const zeroPercent: ObservedNode[] = [];
  for (const n of candidates) {
    if (getLowBatteryRowFlags(n, now).isZeroPercent) zeroPercent.push(n);
    else primary.push(n);
  }

  const byLastHeard = (a: ObservedNode, b: ObservedNode) => lastHeardTime(b) - lastHeardTime(a);
  primary.sort(byLastHeard);
  zeroPercent.sort(byLastHeard);
  return [...primary, ...zeroPercent];
}
