import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { NodeTracerouteLinkEdge, NodeTracerouteLinkNode } from '@/hooks/api/useNodeTracerouteLinks';
import { NodeTracerouteLinksMap } from './NodeTracerouteLinksMap';

vi.mock('react-map-gl/mapbox', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-map-gl/mapbox')>();
  return {
    ...mod,
    Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="popup-mock">{children}</div>,
  };
});

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => ({ mapboxToken: 'pk.test', apiUrl: '' }),
}));

type CapturedDeckProps = {
  initialViewState: Record<string, unknown>;
  layers: unknown[];
};

const deckCaptures: CapturedDeckProps[] = [];

vi.mock('@/components/map/DeckMapboxMap', () => ({
  DeckMapboxMap: (props: CapturedDeckProps) => {
    deckCaptures.push(props);
    return <div data-testid="deck-mapbox-mock">map</div>;
  },
}));

const nodeA: NodeTracerouteLinkNode = {
  node_id: 0x11a,
  node_id_str: '!0000011a',
  short_name: 'A',
  long_name: 'Node A',
  lat: 55.9,
  lng: -4.2,
};

const nodeB: NodeTracerouteLinkNode = {
  node_id: 0x11b,
  node_id_str: '!0000011b',
  short_name: 'B',
  long_name: 'Node B',
  lat: 55.95,
  lng: -4.15,
};

const edge: NodeTracerouteLinkEdge = {
  from_node_id: nodeA.node_id,
  to_node_id: nodeB.node_id,
  from_lng: -4.2,
  from_lat: 55.9,
  to_lng: -4.15,
  to_lat: 55.95,
  avg_snr_in: 5,
  avg_snr_out: 6,
  count: 3,
};

describe('NodeTracerouteLinksMap', () => {
  beforeEach(() => {
    deckCaptures.length = 0;
  });

  it('passes lon/lat/zoom initialViewState when multiple nodes have positions (not bounds)', () => {
    render(
      <MemoryRouter>
        <NodeTracerouteLinksMap edges={[edge]} nodes={[nodeA, nodeB]} focusNodeId={nodeA.node_id} />
      </MemoryRouter>
    );

    expect(screen.getByTestId('deck-mapbox-mock')).toBeInTheDocument();
    expect(deckCaptures).toHaveLength(1);
    const vs = deckCaptures[0].initialViewState;
    expect(vs).not.toHaveProperty('bounds');
    expect(vs).not.toHaveProperty('fitBoundsOptions');
    expect(typeof vs.longitude).toBe('number');
    expect(typeof vs.latitude).toBe('number');
    expect(typeof vs.zoom).toBe('number');
    expect(vs.zoom).toBeLessThanOrEqual(14);
  });

  it('falls back to default center when no nodes have coordinates', () => {
    render(
      <MemoryRouter>
        <NodeTracerouteLinksMap edges={[]} nodes={[]} focusNodeId={1} />
      </MemoryRouter>
    );
    const vs = deckCaptures[0].initialViewState;
    expect(vs).toEqual({ longitude: -4.2518, latitude: 55.8642, zoom: 8 });
  });
});
