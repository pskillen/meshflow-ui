import { describeBattery } from '@/lib/battery';
import type { ObservedNode } from '@/lib/models';

export interface NodeNowCell {
  key: 'battery' | 'channel' | 'airtx' | 'uptime' | 'heard';
  label: string;
  /** Short column heading for the phone table. */
  short: string;
  value: string;
  sub: string;
  /** Emphasised border on the headline tile. */
  hero?: boolean;
}

/** Days when a day or more, else hours or minutes: "14d", "5h", "12m". */
export function formatUptimeShort(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}

/** "5m ago", "3h ago", "2d ago", or "—" when there is no usable time. */
export function formatAgoShort(at: Date | string | number | null | undefined, now: Date = new Date()): string {
  if (at == null) return '—';
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  const seconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const pct = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '—' : `${v.toFixed(1)}%`);

/**
 * The latest readings for the "Right now" row. Last heard is always present; the four device readings only when
 * the node has reported device metrics (MeshCore nodes may not). Battery raw 101 reads "Powered".
 */
export function buildNodeNowCells(node: ObservedNode, now: Date = new Date()): NodeNowCell[] {
  const cells: NodeNowCell[] = [];
  const dm = node.latest_device_metrics;
  if (dm) {
    const battery = describeBattery(dm.battery_level);
    const volts = dm.voltage != null && !Number.isNaN(dm.voltage) ? `${dm.voltage.toFixed(2)} V` : '—';
    cells.push(
      {
        key: 'battery',
        label: 'Battery',
        short: 'Battery',
        value: battery.kind === 'none' ? '—' : battery.kind === 'powered' ? 'Powered' : `${battery.pct}%`,
        sub: volts,
        hero: true,
      },
      {
        key: 'channel',
        label: 'Channel util',
        short: 'Ch util',
        value: pct(dm.meshtastic_channel_utilization),
        sub: 'latest report',
      },
      {
        key: 'airtx',
        label: 'Air util TX',
        short: 'Air TX',
        value: pct(dm.meshtastic_air_util_tx),
        sub: 'latest report',
      },
      {
        key: 'uptime',
        label: 'Uptime',
        short: 'Uptime',
        value: formatUptimeShort(dm.uptime_seconds),
        sub: 'since last boot',
      }
    );
  }
  cells.push({
    key: 'heard',
    label: 'Last heard',
    short: 'Heard',
    value: formatAgoShort(node.last_heard, now),
    sub: 'any packet',
    hero: cells.length === 0,
  });
  return cells;
}
