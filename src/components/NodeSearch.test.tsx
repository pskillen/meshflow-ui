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

const NEW_REF = { internal_id: 'n2', protocol: 1, meshtastic_node_id: 2304338203, node_id_str: '!8959691b' };

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

  async function search() {
    renderSearch();
    await userEvent.type(screen.getByPlaceholderText('Search nodes...'), 'dead');
    await screen.findByText('Dead Beef');
  }

  it('tags a replaced result and links the new node without selecting the old one', async () => {
    api.searchNodes.mockResolvedValue([
      {
        internal_id: 'n1',
        node_id_str: '!433b82f0',
        meshtastic_node_id: 1127973616,
        short_name: 'DEAD',
        long_name: 'Dead Beef',
        replaced_by: NEW_REF,
      },
    ]);
    const onSelect = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NodeSearch onNodeSelect={onSelect} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await userEvent.type(screen.getByPlaceholderText('Search nodes...'), 'dead');
    await screen.findByText('Dead Beef');
    expect(screen.getByTestId('replaced-tag')).toHaveTextContent('Replaced → !8959691b');
    const link = screen.getByRole('link', { name: /Open !8959691b/ });
    expect(link).toHaveAttribute('href', '/nodes/!8959691b');
    link.focus();
    expect(link).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking the tag link closes the dropdown and clears the query', async () => {
    api.searchNodes.mockResolvedValue([
      {
        internal_id: 'n1',
        node_id_str: '!433b82f0',
        meshtastic_node_id: 1127973616,
        short_name: 'DEAD',
        long_name: 'Dead Beef',
        replaced_by: NEW_REF,
      },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NodeSearch />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const input = screen.getByPlaceholderText('Search nodes...');
    await userEvent.type(input, 'dead');
    await screen.findByText('Dead Beef');
    await userEvent.click(screen.getByRole('link', { name: /Open !8959691b/ }));
    expect(screen.queryByText('Dead Beef')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('selecting a replaced row still selects the old node', async () => {
    api.searchNodes.mockResolvedValue([
      {
        internal_id: 'n1',
        node_id_str: '!433b82f0',
        meshtastic_node_id: 1127973616,
        short_name: 'DEAD',
        long_name: 'Dead Beef',
        replaced_by: NEW_REF,
      },
    ]);
    const onSelect = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NodeSearch onNodeSelect={onSelect} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await userEvent.type(screen.getByPlaceholderText('Search nodes...'), 'dead');
    await userEvent.click(await screen.findByText('Dead Beef'));
    expect(onSelect).toHaveBeenCalledWith(1127973616, expect.objectContaining({ node_id_str: '!433b82f0' }));
  });

  it('shows no tag when replaced_by is null or the field is missing', async () => {
    api.searchNodes.mockResolvedValue([
      { internal_id: 'n1', node_id_str: '!deadbeef', meshtastic_node_id: 1, short_name: 'A', long_name: 'Dead Beef', replaced_by: null },
      { internal_id: 'n2', node_id_str: '!deadbee0', meshtastic_node_id: 2, short_name: 'B', long_name: 'Dead Two' },
    ]);
    await search();
    expect(screen.queryByTestId('replaced-tag')).not.toBeInTheDocument();
  });
});
