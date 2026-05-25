import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import type { Feature, Point, Polygon } from 'geojson';

import { boundaryPolygonFromPoints, buildNodePopupHtml } from './map-utils';

function pt(lng: number, lat: number): Feature<Point> {
  return turf.point([lng, lat]);
}

describe('buildNodePopupHtml', () => {
  it('links to internal_id not meshtastic_node_id zero', () => {
    const html = buildNodePopupHtml({
      internal_id: 'a1b2c3d4-e5f6-4789-a012-8456789abcde',
      meshtastic_node_id: 0,
      node_id_str: 'mc:abc',
      long_name: 'Test',
      short_name: 't',
      protocol: 2,
    });
    expect(html).toContain('href="/nodes/a1b2c3d4-e5f6-4789-a012-8456789abcde"');
    expect(html).not.toContain('href="/nodes/0"');
  });
});

describe('boundaryPolygonFromPoints', () => {
  it('returns null for an empty point set', () => {
    expect(boundaryPolygonFromPoints([], 1)).toBeNull();
  });

  it('returns a buffered single-point polygon when given exactly one point', () => {
    const polygon = boundaryPolygonFromPoints([pt(-4.25, 55.86)], 1);
    expect(polygon).not.toBeNull();
    expect(polygon!.geometry.type).toBe('Polygon');
  });

  it('falls back to a buffered point when only two points are provided', () => {
    const polygon = boundaryPolygonFromPoints([pt(-4.25, 55.86), pt(-4.26, 55.87)], 1);
    expect(polygon).not.toBeNull();
    // With <3 points there is no concave/convex hull, so we expect a buffered single point
    // (Polygon, possibly MultiPolygon if buffer crossed antimeridian — not applicable here).
    expect(polygon!.geometry.type === 'Polygon' || polygon!.geometry.type === 'MultiPolygon').toBe(
      true
    );
  });

  it('produces a polygon for a clustered group of 3+ points', () => {
    const points = [
      pt(-4.25, 55.86),
      pt(-4.26, 55.87),
      pt(-4.24, 55.85),
      pt(-4.27, 55.88),
    ];
    const polygon = boundaryPolygonFromPoints(points, 0.5);
    expect(polygon).not.toBeNull();
    expect(polygon!.geometry.type === 'Polygon' || polygon!.geometry.type === 'MultiPolygon').toBe(
      true
    );

    // The boundary should contain every input point after buffering.
    for (const p of points) {
      // turf.booleanPointInPolygon supports both Polygon and MultiPolygon.
      const poly = polygon as Feature<Polygon>;
      expect(turf.booleanPointInPolygon(p, poly)).toBe(true);
    }
  });

  it('falls back to convex hull when concave fails (widely separated points >> maxEdge)', () => {
    // These four points are >> 2 km apart so turf.concave({ maxEdge: 2 }) will
    // produce no triangles and return null. The function should still return a polygon.
    const points = [
      pt(-10.0, 50.0),
      pt(10.0, 50.0),
      pt(10.0, 60.0),
      pt(-10.0, 60.0),
    ];
    const polygon = boundaryPolygonFromPoints(points, 1);
    expect(polygon).not.toBeNull();
    expect(polygon!.geometry.type === 'Polygon' || polygon!.geometry.type === 'MultiPolygon').toBe(
      true
    );
  });
});
