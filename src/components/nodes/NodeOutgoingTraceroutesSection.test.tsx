import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManagedNode } from '@/lib/models';

import { NodeOutgoingTraceroutesSection } from './NodeOutgoingTraceroutesSection';

vi.mock('@/pages/traceroutes/TracerouteDetailModal', () => ({
  TracerouteDetailModal: () => null,
}));

vi.mock('@/hooks/useTraceroutesWithWebSocket', () => ({
  useTraceroutesWithWebSocket: () => ({
    data: { results: [], count: 0, next: null, previous: null },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/api/useTraceroutes', () => ({
  useTracerouteTriggerableNodesSuspense: () => ({ triggerableNodes: [] }),
  useTriggerTraceroute: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function makeManaged(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 42,
    long_name: 'Feeder',
    short_name: 'F1',
    last_heard: null,
    node_id_str: '!0000002a',
    owner: { id: 1, username: 'u' },
    constellation: { id: 1 },
    position: { latitude: null, longitude: null },
    geo_classification: {
      tier: 'internal',
      bearing_octant: null,
      applicable_strategies: ['intra_zone'],
    },
    ...overrides,
  } as ManagedNode;
}

function renderSection(managed: ManagedNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NodeOutgoingTraceroutesSection nodeId={managed.meshtastic_node_id} managed={managed} />
    </QueryClientProvider>
  );
}

describe('NodeOutgoingTraceroutesSection', () => {
  it('renders outgoing heading and recent runs (no feeder strategy pills)', () => {
    renderSection(makeManaged());
    expect(screen.getByTestId('node-detail-outgoing-traceroutes')).toBeInTheDocument();
    expect(screen.queryByTestId('node-detail-feeder-geo')).not.toBeInTheDocument();
    expect(screen.queryByText('Traceroute feeder classification')).not.toBeInTheDocument();
    expect(screen.getByText('Recent runs')).toBeInTheDocument();
    expect(screen.getByText(/No outgoing traceroutes/)).toBeInTheDocument();
  });

  it('renders recent runs when geo_classification is missing', () => {
    renderSection(makeManaged({ geo_classification: null }));
    expect(screen.queryByTestId('node-detail-feeder-geo')).not.toBeInTheDocument();
    expect(screen.getByText('Recent runs')).toBeInTheDocument();
  });
});
