import { describe, it, expect } from 'vitest';
import type { HeatmapEdge } from '@/hooks/api/useHeatmapEdges';
import {
  computeHeatmapArcEncoding,
  edgeArcColor,
  edgeArcWidth,
  degreeFillColor,
  numericExtent,
  staleThresholdMs,
} from '@/components/traceroutes/heatmapEncoding';

describe('heatmapEncoding', () => {
  const edges: HeatmapEdge[] = [
    {
      from_node_id: 1,
      to_node_id: 2,
      from_lat: 0,
      from_lng: 0,
      to_lat: 1,
      to_lng: 1,
      weight: 10,
      avg_snr: 5,
    },
    {
      from_node_id: 2,
      to_node_id: 3,
      from_lat: 0,
      from_lng: 0,
      to_lat: 1,
      to_lng: 1,
      weight: 20,
      avg_snr: 15,
    },
  ];

  it('computes stable arc colours for packets metric', () => {
    const enc = computeHeatmapArcEncoding(edges, 'packets', 0.7);
    expect(enc).not.toBeNull();
    const c0 = edgeArcColor(edges[0], enc!);
    const c1 = edgeArcColor(edges[1], enc!);
    expect(c0).toEqual([59, 130, 246, 200]);
    expect(c1).toEqual([249, 115, 22, 200]);
    expect(edgeArcWidth(edges[0], enc!)).toBeCloseTo(1.9, 5);
  });

  it('degreeFillColor matches numeric extent snapshot', () => {
    const staleMs = staleThresholdMs(6);
    const nowMs = Date.parse('2026-01-15T12:00:00.000Z');
    const fill = degreeFillColor(
      {
        meshtastic_node_id: 1,
        node_id_str: '!1',
        lat: 0,
        lng: 0,
        degree: 5,
        last_seen: '2026-01-15T11:00:00.000Z',
      },
      0,
      10,
      nowMs,
      staleMs
    );
    expect(fill).toEqual([154, 123, 134, 238]);
    expect(numericExtent([3, 1, 4])).toEqual({ min: 1, max: 4 });
  });
});
