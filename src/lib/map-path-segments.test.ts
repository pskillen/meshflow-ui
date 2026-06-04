import { describe, expect, it } from 'vitest';
import { buildPartialSegments, buildSegments } from './map-path-segments';
import type { TracerouteRouteNode } from '@/lib/models';

const start: [number, number] = [55.0, -4.0];
const end: [number, number] = [55.1, -4.1];

describe('buildSegments', () => {
  it('returns dashed segment with unknown labels when hops lack position', () => {
    const nodes: TracerouteRouteNode[] = [
      {
        meshtastic_node_id: 0xffffffff,
        node_id_str: 'ab',
        short_name: 'ab',
        position: null,
      },
    ];
    const segments = buildSegments(start, nodes, end);
    expect(segments).toHaveLength(1);
    expect(segments[0].dashed).toBe(true);
    expect(segments[0].unknownLabels).toEqual([{ node_id_str: 'ab' }]);
  });

  it('returns solid run when all hops have positions', () => {
    const nodes: TracerouteRouteNode[] = [
      {
        meshtastic_node_id: 3,
        node_id_str: '!00000003',
        short_name: 'H1',
        position: { latitude: 55.05, longitude: -4.05 },
      },
    ];
    const segments = buildSegments(start, nodes, end);
    expect(segments.some((s) => !s.dashed)).toBe(true);
  });
});

describe('buildPartialSegments', () => {
  it('starts at first positioned hop when sender is missing', () => {
    const nodes: TracerouteRouteNode[] = [
      {
        meshtastic_node_id: 1,
        node_id_str: 'hop',
        short_name: 'H',
        position: { latitude: 55.05, longitude: -4.05 },
      },
    ];
    const segments = buildPartialSegments({
      startPos: null,
      waypoints: nodes,
      endPos: end,
    });
    expect(segments.length).toBeGreaterThan(0);
  });

  it('omits line to feeder when unknown hops trail last positioned hop', () => {
    const nodes: TracerouteRouteNode[] = [
      {
        meshtastic_node_id: 1,
        node_id_str: 'known',
        short_name: 'K',
        position: { latitude: 55.05, longitude: -4.05 },
      },
      {
        meshtastic_node_id: 2,
        node_id_str: 'unknown',
        short_name: 'unknown',
        position: null,
      },
    ];
    const segments = buildPartialSegments({
      startPos: start,
      waypoints: nodes,
      endPos: end,
      truncateAfterLastKnown: true,
    });
    const reachesFeeder = segments.some(
      (s) =>
        s.latlngs.length > 0 &&
        s.latlngs[s.latlngs.length - 1][0] === end[0] &&
        s.latlngs[s.latlngs.length - 1][1] === end[1]
    );
    expect(reachesFeeder).toBe(false);
  });
});
