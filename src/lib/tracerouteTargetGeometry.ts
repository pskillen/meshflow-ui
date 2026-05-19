import type { GeoClassification, ObservedNode } from '@/lib/models';

const EARTH_R_KM = 6371;

export type ExclusionReason =
  | 'no_position'
  | 'stale_last_heard'
  | 'is_managed'
  | 'is_source'
  | 'outside_envelope'
  | 'inside_envelope'
  | 'outside_wedge'
  | 'included';

export type TargetPreviewStrategy = 'auto' | 'intra_zone' | 'dx_across' | 'dx_same_side';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_R_KM * c;
}

export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return (θ + 360) % 360;
}

export function bearingDifferenceDeg(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Great-circle destination from (lat, lon) moving ``bearingDeg`` clockwise from north. */
export function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceKm: number): [number, number] {
  const δ = distanceKm / EARTH_R_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  const lat2 = (φ2 * 180) / Math.PI;
  const lon2 = (((λ2 * 180) / Math.PI + 540) % 360) - 180;
  return [lat2, lon2];
}

/** Closed ring [lng, lat][] for deck.gl PolygonLayer. */
export function buildCirclePolygon(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  steps = 64
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 * i) / steps;
    const [la, lo] = destinationPoint(centerLat, centerLon, bearing, radiusKm);
    ring.push([lo, la]);
  }
  return ring;
}

/** Wedge from centroid, bearings in [centerBearing - half, centerBearing + half], outer arc at ``radiusKm``. */
export function buildWedgePolygon(
  centerLat: number,
  centerLon: number,
  centerBearingDeg: number,
  halfWindowDeg: number,
  radiusKm: number,
  steps = 40
): [number, number][] {
  const ring: [number, number][] = [[centerLon, centerLat]];
  const from = centerBearingDeg - halfWindowDeg;
  const to = centerBearingDeg + halfWindowDeg;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bearing = from + (to - from) * t;
    const [la, lo] = destinationPoint(centerLat, centerLon, bearing, radiusKm);
    ring.push([lo, la]);
  }
  ring.push([centerLon, centerLat]);
  return ring;
}

export interface ClassifyContext {
  feederNodeId: number;
  managedNodeIds: Set<number>;
  lastHeardCutoff: Date;
  geo: GeoClassification;
  feederLat: number;
  feederLon: number;
}

function observedLatLon(node: ObservedNode): { lat: number; lon: number } | null {
  const lat = node.latest_position?.latitude;
  const lon = node.latest_position?.longitude;
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

export function classifyCandidate(
  node: ObservedNode,
  ctx: ClassifyContext,
  strategy: 'intra_zone' | 'dx_across' | 'dx_same_side',
  halfWindowDeg: number
): { included: boolean; reason: ExclusionReason } {
  if (node.meshtastic_node_id === ctx.feederNodeId) return { included: false, reason: 'is_source' };
  if (ctx.managedNodeIds.has(node.meshtastic_node_id)) return { included: false, reason: 'is_managed' };
  const lh = node.last_heard;
  if (!lh || lh < ctx.lastHeardCutoff) return { included: false, reason: 'stale_last_heard' };
  const pos = observedLatLon(node);
  if (!pos) return { included: false, reason: 'no_position' };

  const c = ctx.geo.selection_centroid;
  if (!c) {
    if (strategy === 'intra_zone') return { included: false, reason: 'outside_envelope' };
    return { included: true, reason: 'included' };
  }

  if (strategy === 'intra_zone') {
    const env = ctx.geo.envelope;
    if (!env) return { included: false, reason: 'outside_envelope' };
    const d = haversineKm(env.centroid_lat, env.centroid_lon, pos.lat, pos.lon);
    if (d <= env.radius_km) return { included: true, reason: 'included' };
    return { included: false, reason: 'outside_envelope' };
  }

  const env = ctx.geo.envelope;
  if (env) {
    const dCent = haversineKm(env.centroid_lat, env.centroid_lon, pos.lat, pos.lon);
    if (dCent <= env.radius_km) return { included: false, reason: 'inside_envelope' };
  }

  const brSrc = ctx.geo.source_bearing_deg;
  if (brSrc == null) return { included: true, reason: 'included' };

  const across = strategy === 'dx_across';
  const centerBearing = across ? (brSrc + 180) % 360 : brSrc;
  const brT = initialBearingDeg(c.lat, c.lon, pos.lat, pos.lon);
  if (bearingDifferenceDeg(brT, centerBearing) > halfWindowDeg) {
    return { included: false, reason: 'outside_wedge' };
  }
  return { included: true, reason: 'included' };
}

export function classifyForAuto(
  node: ObservedNode,
  ctx: ClassifyContext,
  applicable: ('intra_zone' | 'dx_across' | 'dx_same_side')[],
  halfWindowDeg: number
): { included: boolean; reason: ExclusionReason } {
  if (applicable.length === 0) return { included: false, reason: 'outside_wedge' };
  const results = applicable.map((s) => classifyCandidate(node, ctx, s, halfWindowDeg));
  const ok = results.find((r) => r.included);
  if (ok) return ok;
  return results[0]!;
}

export function suggestedWedgeRadiusKm(
  feederLat: number,
  feederLon: number,
  centroid: { lat: number; lon: number },
  envelope: GeoClassification['envelope'],
  candidates: ObservedNode[]
): number {
  let maxD = haversineKm(centroid.lat, centroid.lon, feederLat, feederLon);
  if (envelope) maxD = Math.max(maxD, envelope.radius_km * 2.5);
  for (const n of candidates) {
    const pos = observedLatLon(n);
    if (!pos) continue;
    maxD = Math.max(maxD, haversineKm(centroid.lat, centroid.lon, pos.lat, pos.lon));
  }
  return Math.min(900, Math.max(100, maxD * 1.2));
}
