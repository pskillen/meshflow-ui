import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';
import { ProtocolNodesPage } from './ProtocolNodesPage';

const api = { getObservedNodes: vi.fn() };
vi.mock('@/hooks/api/useApi', () => ({ useMeshflowApi: () => api }));
vi.mock('@/hooks/api/useNodes', () => ({
  useManagedNodesSuspense: () => ({ managedNodes: [] }),
}));
vi.mock('@/hooks/api/useMeshCore', () => ({
  useMeshCoreManagedNodesSuspense: () => ({ feeders: [] }),
}));
vi.mock('@/components/nodes/NodesAndConstellationsMap', () => ({ NodesAndConstellationsMap: () => null }));
vi.mock('@/components/nodes/NodesMap', () => ({ NodesMap: () => null }));
vi.mock('@/components/nodes/NodeCard', () => ({ NodeCard: () => null }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Suspense fallback={<div>loading</div>}>{children}</Suspense>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ProtocolNodesPage config={MESHTASTIC_CONFIG} />, { wrapper: Wrapper });
}

function page(next: string | null) {
  return { count: 1500, next, previous: null, results: [] };
}

describe('ProtocolNodesPage', () => {
  beforeEach(() => {
    api.getObservedNodes.mockReset();
  });

  it('requests 1000 nodes per page and shows the notice and Load more when there is a next page', async () => {
    api.getObservedNodes.mockResolvedValue(page('http://api/next'));
    renderPage();

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(api.getObservedNodes).toHaveBeenCalledTimes(1);
    expect(api.getObservedNodes).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 1000 }));
    expect(screen.getByRole('status')).toHaveTextContent(/Showing the first 0 of 1500 nodes/);
    expect(screen.getAllByRole('button', { name: 'Load more' }).length).toBeGreaterThan(0);
  });

  it('shows neither the notice nor Load more when everything fits in one page', async () => {
    api.getObservedNodes.mockResolvedValue(page(null));
    renderPage();

    await screen.findByRole('heading', { name: MESHTASTIC_CONFIG.labels.nodesTitle });
    expect(api.getObservedNodes).toHaveBeenCalledWith(expect.objectContaining({ page_size: 1000 }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
