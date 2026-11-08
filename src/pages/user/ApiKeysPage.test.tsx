import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { ApiKeysPage } from '@/pages/user/ApiKeysPage';

const api = {
  getApiKeys: vi.fn(),
  addNodeToApiKey: vi.fn(),
  removeNodeFromApiKey: vi.fn(),
  createApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
};

vi.mock('@/hooks/api/useApi', () => ({ useMeshtasticApi: () => api }));
vi.mock('@/hooks/api/useConstellations', () => ({
  useConstellationsSuspense: () => ({ constellations: [{ id: 1, name: 'North', map_color: '#123456' }] }),
}));
vi.mock('@/hooks/api/useNodes', () => ({
  useMyManagedNodesSuspense: () => ({
    myManagedNodes: [
      { internal_id: 'a', meshtastic_node_id: 1, node_id_str: '!a', short_name: 'AAA', constellation: { id: 1 } },
      { internal_id: 'b', meshtastic_node_id: 2, node_id_str: '!b', short_name: 'BBB', constellation: { id: 1 } },
    ],
  }),
}));

function key(linked: string[]) {
  return {
    id: 'k1',
    name: 'My key',
    key: 'secret',
    constellation: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    last_used: null,
    nodes: [],
    linked_managed_nodes: linked.map((internal_id) => ({ internal_id })),
  };
}

function apiError(data: unknown) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data,
    statusText: 'Bad Request',
    headers: {},
    config: {} as never,
  });
}

async function renderAndOpenModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ApiKeysPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Assign Feeder' }));
}

describe('ApiKeysPage assign feeder modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.addNodeToApiKey.mockResolvedValue({});
    api.removeNodeFromApiKey.mockResolvedValue({});
  });

  it('renders radios (not checkboxes) and swaps A for B by removing A before adding B', async () => {
    api.getApiKeys.mockResolvedValue([key(['a'])]);
    await renderAndOpenModal();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getAllByRole('radio')).toHaveLength(3); // None, AAA, BBB
    expect(screen.getByText(/One feeder per key/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'AAA' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'BBB' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.addNodeToApiKey).toHaveBeenCalledWith('k1', { managedNodeInternalId: 'b' }));
    expect(api.removeNodeFromApiKey).toHaveBeenCalledWith('k1', { managedNodeInternalId: 'a' });
    expect(api.removeNodeFromApiKey.mock.invocationCallOrder[0]).toBeLessThan(
      api.addNodeToApiKey.mock.invocationCallOrder[0]
    );
  });

  it('None removes the link without adding anything', async () => {
    api.getApiKeys.mockResolvedValue([key(['a'])]);
    await renderAndOpenModal();

    await userEvent.click(screen.getByRole('radio', { name: 'None' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.removeNodeFromApiKey).toHaveBeenCalledWith('k1', { managedNodeInternalId: 'a' }));
    expect(api.addNodeToApiKey).not.toHaveBeenCalled();
  });

  it('shows the API error text when add_node returns api_key_already_linked', async () => {
    api.getApiKeys.mockResolvedValue([key([])]);
    const message = 'This API key is already linked to a feeder. Create a separate key for each feeder.';
    api.addNodeToApiKey.mockRejectedValue(apiError({ error: message, code: 'api_key_already_linked' }));
    await renderAndOpenModal();

    await userEvent.click(screen.getByRole('radio', { name: 'AAA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('marks a shared key, lists its feeders read-only and offers no picker', async () => {
    api.getApiKeys.mockResolvedValue([key(['a', 'b'])]);
    await renderAndOpenModal();

    expect(screen.getAllByText('Shared (legacy)').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Linked feeders' });
    expect(within(list).getByText('AAA')).toBeInTheDocument();
    expect(within(list).getByText('BBB')).toBeInTheDocument();

    await userEvent.click(within(list).getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(api.removeNodeFromApiKey).toHaveBeenCalledWith('k1', { managedNodeInternalId: 'a' }));
    expect(api.addNodeToApiKey).not.toHaveBeenCalled();
  });
});
