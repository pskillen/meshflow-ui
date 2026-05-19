import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { HeatmapEdge, HeatmapNode } from '@/hooks/api/useHeatmapEdges';
import { TracerouteHeatmapMap } from './TracerouteHeatmapMap';

/** Real <Popup> needs MapContext; test only needs layer stability, not mapbox popups. */
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

type MockMapboxProps = {
  layers: { id: string }[];
  onClick?: (info: { object: unknown; layer: { id: string } }) => void;
  children?: React.ReactNode;
};

const mapboxCaptures: MockMapboxProps[] = [];

vi.mock('@/components/map/DeckMapboxMap', () => ({
  DeckMapboxMap: (props: MockMapboxProps) => {
    mapboxCaptures.push(props);
    return (
      <div data-testid="deck-mapbox-mock">
        <button
          type="button"
          data-testid="mock-pick-node"
          onClick={() =>
            props.onClick?.({
              object: nodeA,
              layer: { id: 'heatmap-nodes' },
            })
          }
        >
          pick
        </button>
        {props.children}
      </div>
    );
  },
}));

const nodeA: HeatmapNode = {
  node_id: 0x11a,
  node_id_str: '!0000011a',
  short_name: 'A',
  long_name: 'Node A',
  lat: 55.9,
  lng: -4.2,
};

const nodeB: HeatmapNode = {
  node_id: 0x11b,
  node_id_str: '!0000011b',
  short_name: 'B',
  long_name: 'Node B',
  lat: 55.95,
  lng: -4.15,
};

const edge: HeatmapEdge = {
  from_node_id: nodeA.node_id,
  to_node_id: nodeB.node_id,
  from_lng: -4.2,
  from_lat: 55.9,
  to_lng: -4.15,
  to_lat: 55.95,
  weight: 5,
  avg_snr: 4,
};

const hub: HeatmapNode = {
  node_id: 0x11c,
  node_id_str: '!0000011c',
  short_name: 'Hub',
  long_name: 'Hub',
  lat: 55.92,
  lng: -4.18,
  role: 'backbone',
  degree: 3,
  centrality: 0.4,
};

const spoke: HeatmapNode = {
  node_id: 0x11d,
  node_id_str: '!0000011d',
  short_name: 'Spoke',
  long_name: 'Spoke',
  lat: 55.91,
  lng: -4.19,
  role: 'leaf',
  degree: 1,
  centrality: 0,
};

const peer: HeatmapNode = {
  node_id: 0x11e,
  node_id_str: '!0000011e',
  short_name: 'Peer',
  long_name: 'Peer',
  lat: 55.93,
  lng: -4.17,
  role: 'backbone',
  degree: 3,
  centrality: 0.35,
};

const edgeHubSpoke: HeatmapEdge = {
  from_node_id: hub.node_id,
  to_node_id: spoke.node_id,
  from_lng: hub.lng,
  from_lat: hub.lat,
  to_lng: spoke.lng,
  to_lat: spoke.lat,
  weight: 3,
  avg_snr: 5,
};

const edgeHubPeer: HeatmapEdge = {
  from_node_id: hub.node_id,
  to_node_id: peer.node_id,
  from_lng: hub.lng,
  from_lat: hub.lat,
  to_lng: peer.lng,
  to_lat: peer.lat,
  weight: 8,
  avg_snr: 6,
};

function layerIds(layers: { id: string }[]) {
  return layers.map((l) => l.id);
}

function lastCapture() {
  return mapboxCaptures[mapboxCaptures.length - 1];
}

function Harness(
  props: Omit<ComponentProps<typeof TracerouteHeatmapMap>, 'selectedNode' | 'onSelectedNodeChange'>
) {
  const [selected, setSelected] = useState<HeatmapNode | null>(null);
  return <TracerouteHeatmapMap {...props} selectedNode={selected} onSelectedNodeChange={setSelected} />;
}

describe('TracerouteHeatmapMap', () => {
  beforeEach(() => {
    mapboxCaptures.length = 0;
  });

  it('keeps arc layers after popup selection state (mock click / onClick)', () => {
    render(
      <MemoryRouter>
        <Harness edges={[edge]} nodes={[nodeA, nodeB]} edgeMetric="packets" />
      </MemoryRouter>
    );

    expect(layerIds(lastCapture().layers)).toEqual(
      expect.arrayContaining(['heatmap-arcs-packets', 'heatmap-nodes'])
    );

    fireEvent.click(screen.getByTestId('mock-pick-node'));

    expect(layerIds(lastCapture().layers)).toEqual(
      expect.arrayContaining(['heatmap-arcs-packets', 'heatmap-nodes'])
    );
  });

  it('swaps arc layer id when edgeMetric changes but keeps node layers', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Harness edges={[edge]} nodes={[nodeA, nodeB]} edgeMetric="packets" />
      </MemoryRouter>
    );

    expect(lastCapture().layers.some((l) => l.id === 'heatmap-arcs-packets')).toBe(true);

    rerender(
      <MemoryRouter>
        <Harness edges={[edge]} nodes={[nodeA, nodeB]} edgeMetric="snr" />
      </MemoryRouter>
    );

    expect(lastCapture().layers.some((l) => l.id === 'heatmap-arcs-snr')).toBe(true);
    expect(lastCapture().layers.some((l) => l.id === 'heatmap-nodes')).toBe(true);
  });

  it('omits leaf path layer when no edge touches a leaf node', () => {
    render(
      <MemoryRouter>
        <Harness edges={[edgeHubPeer]} nodes={[hub, peer]} edgeMetric="packets" />
      </MemoryRouter>
    );
    expect(layerIds(lastCapture().layers)).toEqual(
      expect.arrayContaining(['heatmap-arcs-packets', 'heatmap-nodes'])
    );
    expect(lastCapture().layers.some((l) => l.id === 'heatmap-leaf-edges-packets')).toBe(false);
  });

  it('uses grey dashed path layer for edges touching a leaf, plus arcs for remaining edges', () => {
    render(
      <MemoryRouter>
        <Harness
          edges={[edgeHubSpoke, edgeHubPeer]}
          nodes={[hub, spoke, peer]}
          edgeMetric="packets"
        />
      </MemoryRouter>
    );
    const ids = layerIds(lastCapture().layers);
    expect(ids).toEqual(expect.arrayContaining(['heatmap-leaf-edges-packets', 'heatmap-arcs-packets', 'heatmap-nodes']));
  });
});
