import { MANAGED_NODE_ONLINE_MAX_AGE_SECONDS } from '@/lib/managed-node-status';
import { formatRecencyRelative } from '@/lib/reported-time-format';
import type { ManagedNode, ObservedNode, Position } from '@/lib/models';

/** Claimed-node “online”: same window as dashboard “2h” and the Meshtastic bot’s online threshold. */
export const MY_NODES_CLAIMED_ONLINE_MS = 2 * 60 * 60 * 1000;

/** Upper bound for “last heard recently” (exclusive above this → offline). */
export const MY_NODES_CLAIMED_RECENT_MS = 7 * 24 * 60 * 60 * 1000;

const MS_PER_SECOND = 1000;

export const MY_NODES_FEEDER_FRESH_MS = MANAGED_NODE_ONLINE_MAX_AGE_SECONDS * MS_PER_SECOND;

export type ConnectivityBucket = 'online' | 'recent' | 'offline';

export type ManagedLivenessSeverity = 'ok' | 'warn' | 'destructive';

export interface ManagedLiveness {
  feeder: 'fresh' | 'stale';
  radio: 'fresh' | 'stale';
  severity: ManagedLivenessSeverity;
  /** User-facing summary; null when severity is `ok`. */
  message: string | null;
}

/** Visual band for position copy on MyNodeCard (aligns with StaleReportedTime-style treatments). */
export type PositionHintTreatment = 'ok' | 'stale' | 'missing';

export interface PositionHint {
  label: string;
  /** Shown in tooltip when useful (e.g. exact relative age). */
  tooltip: string | null;
  treatment: PositionHintTreatment;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Buckets for **claimed** nodes on My Nodes (by `last_heard` only).
 * - Online: ≤ 2h
 * - Recent: > 2h and ≤ 7d
 * - Offline: null or > 7d
 * Future clock skew: if last_heard is in the future, treat as online.
 */
export function bucketForLastHeard(
  lastHeard: Date | string | null | undefined,
  now: Date = new Date()
): ConnectivityBucket {
  const d = parseDate(lastHeard);
  if (!d) return 'offline';
  const ageMs = now.getTime() - d.getTime();
  if (ageMs < 0) return 'online';
  if (ageMs <= MY_NODES_CLAIMED_ONLINE_MS) return 'online';
  if (ageMs <= MY_NODES_CLAIMED_RECENT_MS) return 'recent';
  return 'offline';
}

export function groupClaimedNodes(
  nodes: ObservedNode[],
  now: Date = new Date()
): Record<ConnectivityBucket, ObservedNode[]> {
  const out: Record<ConnectivityBucket, ObservedNode[]> = {
    online: [],
    recent: [],
    offline: [],
  };
  for (const n of nodes) {
    out[bucketForLastHeard(n.last_heard, now)].push(n);
  }
  return out;
}

function isFresh(at: Date | string | null | undefined, maxAgeMs: number, now: Date): boolean {
  const d = parseDate(at);
  if (!d) return false;
  const ageMs = now.getTime() - d.getTime();
  if (ageMs < 0) return true;
  return ageMs <= maxAgeMs;
}

function agePhrase(at: Date | string | null | undefined): string {
  const d = parseDate(at);
  if (!d) return 'never';
  return formatRecencyRelative(d, 'never');
}

/** Mesh-side activity: prefer `radio_last_heard`, else `last_heard`. */
export function managedRadioActivityAt(
  node: Pick<ManagedNode, 'radio_last_heard' | 'last_heard'>
): Date | string | null {
  if (node.radio_last_heard != null) return node.radio_last_heard;
  return node.last_heard;
}

/**
 * Dual-signal liveness for managed nodes on My Nodes.
 * Feeder fresh = `last_packet_ingested_at` within 10m (when the field is present).
 * Radio fresh = `radio_last_heard` (or `last_heard`) within 2h.
 *
 * When `last_packet_ingested_at` is missing (e.g. API omitted status) but radio activity
 * is within the same “online” window as claimed nodes, we do not show a feeder warning —
 * mesh recency is the user-visible signal.
 */
export function getManagedLiveness(
  node: Pick<ManagedNode, 'last_packet_ingested_at' | 'radio_last_heard' | 'last_heard'>,
  now: Date = new Date()
): ManagedLiveness {
  const noIngestedAt = node.last_packet_ingested_at == null;
  const feederFresh = !noIngestedAt && isFresh(node.last_packet_ingested_at, MY_NODES_FEEDER_FRESH_MS, now);
  const radioAt = managedRadioActivityAt(node);
  const radioFresh = isFresh(radioAt, MY_NODES_CLAIMED_ONLINE_MS, now);

  if (radioFresh && (feederFresh || noIngestedAt)) {
    return { feeder: 'fresh', radio: 'fresh', severity: 'ok', message: null };
  }

  const feeder: 'fresh' | 'stale' = feederFresh ? 'fresh' : 'stale';
  const radio: 'fresh' | 'stale' = radioFresh ? 'fresh' : 'stale';

  const feederAge = agePhrase(node.last_packet_ingested_at);
  const radioAge = agePhrase(radioAt);

  if (!feederFresh && radioFresh) {
    return {
      feeder,
      radio,
      severity: 'warn',
      message: `Feeder not reporting to Meshflow — last packet ${feederAge}.`,
    };
  }
  if (feederFresh && !radioFresh) {
    return {
      feeder,
      radio,
      severity: 'warn',
      message: `Radio hasn't heard anything on the mesh — last activity ${radioAge}.`,
    };
  }
  return {
    feeder,
    radio,
    severity: 'destructive',
    message: `Managed node offline — feeder last packet ${feederAge}; last mesh activity ${radioAge}.`,
  };
}

const POSITION_STALE_MS = MY_NODES_CLAIMED_RECENT_MS;

function hasValidCoords(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat == null || lon == null) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}

/** User-facing GPS / last reported position hint for node cards. */
export function getPositionHint(node: ObservedNode, now: Date = new Date()): PositionHint {
  const pos = node.latest_position as
    | {
        latitude?: number;
        longitude?: number;
        reported_time?: Date | string | null;
      }
    | null
    | undefined;

  if (!pos) {
    return { label: 'No GPS position', tooltip: null, treatment: 'missing' };
  }
  const lat = pos.latitude;
  const lon = pos.longitude;
  if (!hasValidCoords(lat, lon)) {
    return { label: 'No GPS position', tooltip: null, treatment: 'missing' };
  }

  const reported = parseDate(pos.reported_time ?? null);
  if (!reported) {
    return {
      label: 'GPS position recent',
      tooltip: 'Position reported; no exact timestamp on record.',
      treatment: 'ok',
    };
  }
  const ageMs = now.getTime() - reported.getTime();
  if (ageMs < 0) {
    return {
      label: 'GPS position recent',
      tooltip: `Reported ${formatRecencyRelative(reported)}`,
      treatment: 'ok',
    };
  }
  if (ageMs <= POSITION_STALE_MS) {
    return {
      label: 'GPS position recent',
      tooltip: `Reported ${formatRecencyRelative(reported)}`,
      treatment: 'ok',
    };
  }
  return {
    label: 'GPS position stale (>7d)',
    tooltip: `Reported ${formatRecencyRelative(reported)}`,
    treatment: 'stale',
  };
}

function positionFromManaged(m: ManagedNode): Position | null {
  const lat = m.position?.latitude;
  const lon = m.position?.longitude;
  if (!hasValidCoords(lat ?? null, lon ?? null)) return null;
  return {
    latitude: lat!,
    longitude: lon!,
    reported_time: null,
    logged_time: null,
    altitude: null,
    location_source: 'managed',
  };
}

function hasValidObservedPosition(p: Position | null | undefined): boolean {
  if (!p) return false;
  return hasValidCoords(p.latitude, p.longitude);
}

/**
 * Synthetic `ObservedNode` for a managed-only row (map / fallbacks).
 * Prefer merging a real claimed `ObservedNode` via `observedNodeForManagedRow` when available.
 */
export function managedNodeToObservedNode(m: ManagedNode): ObservedNode {
  const latest_position = positionFromManaged(m);
  return {
    internal_id: 0,
    meshtastic_node_id: m.meshtastic_node_id,
    node_id_str: m.node_id_str,
    mac_addr: null,
    long_name: m.long_name,
    short_name: m.short_name,
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    meshtastic_role: null,
    last_heard: m.last_heard ?? null,
    latest_position,
    latest_device_metrics: null,
    owner: m.owner,
  };
}

/** Prefer claimed telemetry/position; fill map position from managed default when missing. */
export function mergeManagedPositionIntoObserved(node: ObservedNode, m: ManagedNode): ObservedNode {
  if (hasValidObservedPosition(node.latest_position)) return node;
  const pos = positionFromManaged(m);
  if (!pos) return node;
  return { ...node, latest_position: pos };
}

/**
 * Union of claimed + managed for `NodesMap` / battery chart: one entry per `meshtastic_node_id`.
 * When both exist, claimed data wins; managed fills in default position if needed.
 */
export function buildNodesForMap(claimed: ObservedNode[], managed: ManagedNode[]): ObservedNode[] {
  const map = new Map<number, ObservedNode>();
  for (const c of claimed) {
    map.set(c.meshtastic_node_id, c);
  }
  for (const m of managed) {
    const existing = map.get(m.meshtastic_node_id);
    if (existing) {
      map.set(m.meshtastic_node_id, mergeManagedPositionIntoObserved(existing, m));
    } else {
      map.set(m.meshtastic_node_id, managedNodeToObservedNode(m));
    }
  }
  return [...map.values()];
}

/** Card row for a managed node: full observed payload when user also claimed it. */
export function observedNodeForManagedRow(m: ManagedNode, claimed: ObservedNode | undefined): ObservedNode {
  if (claimed) {
    return mergeManagedPositionIntoObserved(claimed, m);
  }
  return managedNodeToObservedNode(m);
}
