import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ManagedNode, ObservedNode } from '@/lib/models';

import { InfrastructureNodeCard } from './InfrastructureNodeCard';

vi.mock('@/hooks/api/useRfPropagation', () => ({
  useRfProfile: () => ({ data: null, isLoading: false }),
  useRfPropagation: () => ({ data: { status: 'none' }, isLoading: false }),
  useUpdateRfProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecomputeRfPropagation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function minimalManaged(nodeId: number): ManagedNode {
  return {
    meshtastic_node_id: nodeId,
    long_name: null,
    short_name: null,
    last_heard: null,
    node_id_str: '!0',
    owner: { id: 1, username: 'u' },
    constellation: { id: 1 },
    position: { latitude: null, longitude: null },
  } as ManagedNode;
}

function renderCard(node: ObservedNode, opts?: { managedNode?: ManagedNode | null }) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InfrastructureNodeCard node={node} managedNode={opts?.managedNode ?? null} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function makeNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Hilltop',
    short_name: 'HILL',
    hw_model: null,
    public_key: null,
    role: 2,
    last_heard: new Date('2026-04-19T10:00:00Z'),
    latest_position: null,
    ...overrides,
  } as ObservedNode;
}

describe('InfrastructureNodeCard', () => {
  it('renders Coverage map link only when the infra node is a managed feeder', () => {
    renderCard(makeNode({ meshtastic_node_id: 4242 }), { managedNode: minimalManaged(4242) });
    const link = screen.getByTestId('infra-coverage-link-4242');
    expect(link.getAttribute('href')).toBe('/traceroutes/map/coverage?feeder=4242');
  });

  it('does not render Coverage map link for unmanaged infrastructure nodes', () => {
    renderCard(makeNode({ meshtastic_node_id: 4242 }));
    expect(screen.queryByTestId('infra-coverage-link-4242')).not.toBeInTheDocument();
  });

  it('also renders the Open node details link to /nodes/<meshtastic_node_id>', () => {
    renderCard(makeNode({ meshtastic_node_id: 7 }));
    const detailsLink = screen.getByRole('link', { name: /open node details/i });
    expect(detailsLink.getAttribute('href')).toBe('/nodes/7');
  });

  it('shows Propagation map only when has_ready_rf_render is true', () => {
    const client = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InfrastructureNodeCard node={makeNode({ meshtastic_node_id: 9, has_ready_rf_render: false })} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.queryByTestId('infra-propagation-map-9')).not.toBeInTheDocument();
    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InfrastructureNodeCard node={makeNode({ meshtastic_node_id: 9, has_ready_rf_render: true })} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('infra-propagation-map-9')).toBeInTheDocument();
  });
});
