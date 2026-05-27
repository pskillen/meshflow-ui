import { describe, expect, it } from 'vitest';
import { buildSegments } from './map-path-segments';
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
