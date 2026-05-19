import { describe, it, expect } from 'vitest';
import type { GeoClassification, ObservedNode } from '@/lib/models';
import {
  bearingDifferenceDeg,
  buildCirclePolygon,
  classifyCandidate,
  classifyForAuto,
  destinationPoint,
  haversineKm,
  initialBearingDeg,
} from './tracerouteTargetGeometry';

function makeGeo(overrides: Partial<GeoClassification> = {}): GeoClassification {
  return {
    tier: 'perimeter',
    bearing_octant: 'N',
    applicable_strategies: ['intra_zone', 'dx_across', 'dx_same_side'],
    envelope: {
      centroid_lat: 55.0,
      centroid_lon: -4.25,
      radius_km: 10,
    },
    selection_centroid: { lat: 55.0, lon: -4.25 },
    source_bearing_deg: 90,
    selector_params: {
      last_heard_within_hours: 3,
      dx_half_window_sweep_deg: [45, 60, 75, 90],
      perimeter_distance_fraction: 0.6,
    },
    ...overrides,
  };
}

function makeObserved(overrides: Partial<ObservedNode> = {}): ObservedNode {
  const now = new Date();
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 99,
    node_id_str: '!00000063',
    mac_addr: null,
    long_name: 'T',
    short_name: 'T',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: now,
    latest_position: { latitude: 55.05, longitude: -4.25, reported_time: now, logged_time: now, altitude: null, meshtastic_location_source: 'gps' },
    ...overrides,
  } as ObservedNode;
}

describe('tracerouteTargetGeometry', () => {
  it('haversineKm is zero for identical points', () => {
    expect(haversineKm(1, 2, 1, 2)).toBe(0);
  });

  it('initialBearingDeg north is ~0 for lat move only', () => {
    const b = initialBearingDeg(0, 0, 1, 0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(1);
  });

  it('bearingDifferenceDeg handles wrap', () => {
    expect(bearingDifferenceDeg(350, 10)).toBe(20);
  });

  it('buildCirclePolygon closes the ring', () => {
    const ring = buildCirclePolygon(55, -4.25, 5, 8);
    expect(ring.length).toBe(9);
    expect(ring[0]![0]).toBeCloseTo(ring[8]![0], 5);
    expect(ring[0]![1]).toBeCloseTo(ring[8]![1], 5);
  });

  it('classifyCandidate intra includes point on envelope boundary', () => {
    const geo = makeGeo();
    const onRing = makeObserved({
      meshtastic_node_id: 501,
      latest_position: {
        latitude: destinationPoint(geo.envelope!.centroid_lat, geo.envelope!.centroid_lon, 0, geo.envelope!.radius_km)[0],
        longitude: destinationPoint(geo.envelope!.centroid_lat, geo.envelope!.centroid_lon, 0, geo.envelope!.radius_km)[1],
        reported_time: new Date(),
        logged_time: new Date(),
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const ctx = {
      feederNodeId: 1,
      managedNodeIds: new Set<number>(),
      lastHeardCutoff: new Date(Date.now() - 4 * 60 * 60 * 1000),
      geo,
      feederLat: 55.2,
      feederLon: -4.25,
    };
    const r = classifyCandidate(onRing, ctx, 'intra_zone', 45);
    expect(r.included).toBe(true);
  });

  it('classifyCandidate dx excludes inside envelope', () => {
    const geo = makeGeo();
    const inside = makeObserved({
      meshtastic_node_id: 502,
      latest_position: {
        latitude: 55.01,
        longitude: -4.25,
        reported_time: new Date(),
        logged_time: new Date(),
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const ctx = {
      feederNodeId: 1,
      managedNodeIds: new Set<number>(),
      lastHeardCutoff: new Date(Date.now() - 4 * 60 * 60 * 1000),
      geo,
      feederLat: 55.2,
      feederLon: -4.25,
    };
    expect(classifyCandidate(inside, ctx, 'dx_across', 45).included).toBe(false);
    expect(classifyCandidate(inside, ctx, 'dx_across', 45).reason).toBe('inside_envelope');
  });

  it('classifyCandidate excludes stale last_heard', () => {
    const geo = makeGeo();
    const stale = makeObserved({
      meshtastic_node_id: 503,
      last_heard: new Date(Date.now() - 5 * 60 * 60 * 1000),
    });
    const ctx = {
      feederNodeId: 1,
      managedNodeIds: new Set<number>(),
      lastHeardCutoff: new Date(Date.now() - 3 * 60 * 60 * 1000),
      geo,
      feederLat: 55.2,
      feederLon: -4.25,
    };
    expect(classifyCandidate(stale, ctx, 'intra_zone', 45).reason).toBe('stale_last_heard');
  });

  it('classifyCandidate dx_across vs dx_same_side differ at bearing 180', () => {
    const geo = makeGeo({
      source_bearing_deg: 180,
      envelope: null,
      selection_centroid: { lat: 55.0, lon: -4.25 },
    });
    const north = makeObserved({
      meshtastic_node_id: 504,
      latest_position: {
        latitude: 56.0,
        longitude: -4.25,
        reported_time: new Date(),
        logged_time: new Date(),
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const south = makeObserved({
      meshtastic_node_id: 505,
      latest_position: {
        latitude: 53.5,
        longitude: -4.25,
        reported_time: new Date(),
        logged_time: new Date(),
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const ctx = {
      feederNodeId: 1,
      managedNodeIds: new Set<number>(),
      lastHeardCutoff: new Date(Date.now() - 4 * 60 * 60 * 1000),
      geo,
      feederLat: 54.0,
      feederLon: -4.25,
    };
    expect(classifyCandidate(north, ctx, 'dx_across', 45).included).toBe(true);
    expect(classifyCandidate(north, ctx, 'dx_same_side', 45).included).toBe(false);
    expect(classifyCandidate(south, ctx, 'dx_across', 45).included).toBe(false);
    expect(classifyCandidate(south, ctx, 'dx_same_side', 45).included).toBe(true);
  });

  it('classifyForAuto includes if any applicable strategy matches', () => {
    const geo = makeGeo({
      applicable_strategies: ['intra_zone', 'dx_across'],
    });
    const insideIntra = makeObserved({
      meshtastic_node_id: 505,
      latest_position: {
        latitude: 55.05,
        longitude: -4.25,
        reported_time: new Date(),
        logged_time: new Date(),
        altitude: null,
        meshtastic_location_source: 'gps',
      },
    });
    const ctx = {
      feederNodeId: 1,
      managedNodeIds: new Set<number>(),
      lastHeardCutoff: new Date(Date.now() - 4 * 60 * 60 * 1000),
      geo,
      feederLat: 55.2,
      feederLon: -4.25,
    };
    expect(classifyForAuto(insideIntra, ctx, geo.applicable_strategies, 45).included).toBe(true);
  });
});
