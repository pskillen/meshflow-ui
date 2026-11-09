import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NodeSearch } from './NodeSearch';

const api = {
  getNodes: vi.fn(),
  getObservedNodes: vi.fn(),
  getManagedNodes: vi.fn(),
  getMyManagedNodes: vi.fn(),
  getMyClaimedNodes: vi.fn(),
  searchNodes: vi.fn(),
};

vi.mock('@/hooks/api/useApi', () => ({ useMeshflowApi: () => api }));

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NodeSearch />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('NodeSearch', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.searchNodes.mockResolvedValue([
      {
        internal_id: 'n1',
        node_id_str: '!deadbeef',
        meshtastic_node_id: 3735928559,
        short_name: 'DEAD',
        long_name: 'Dead Beef',
      },
    ]);
  });

  it('makes no list requests on mount', async () => {
    renderSearch();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.getNodes).not.toHaveBeenCalled();
    expect(api.getObservedNodes).not.toHaveBeenCalled();
    expect(api.getManagedNodes).not.toHaveBeenCalled();
    expect(api.getMyManagedNodes).not.toHaveBeenCalled();
    expect(api.getMyClaimedNodes).not.toHaveBeenCalled();
    expect(api.searchNodes).not.toHaveBeenCalled();
  });

  it('still searches and shows results once the user types', async () => {
    renderSearch();
    await userEvent.type(screen.getByPlaceholderText('Search nodes...'), 'dead');
    await waitFor(() => expect(api.searchNodes).toHaveBeenCalledWith('dead'));
    expect(await screen.findByText('Dead Beef')).toBeInTheDocument();
    expect(api.getNodes).not.toHaveBeenCalled();
  });
});
