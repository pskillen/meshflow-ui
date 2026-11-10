import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { RightNowBand } from './RightNowBand';

const getRecentNodeCounts = vi.fn<(protocol?: string) => Promise<Record<string, number>>>();
vi.mock('@/hooks/api/useApi', () => ({
  useMeshflowApi: () => ({ getRecentNodeCounts }),
}));

function renderBand(scope: 'both' | 'meshtastic') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <div data-testid="page">
        <RightNowBand scope={scope} />
      </div>
    </QueryClientProvider>,
  );
  return client;
}

describe('RightNowBand fetching and boundaries', () => {
  it('both: starts the Meshtastic and MeshCore requests together, under the same cache keys', async () => {
    getRecentNodeCounts.mockReset();
    const resolvers: Record<string, (v: Record<string, number>) => void> = {};
    getRecentNodeCounts.mockImplementation(
      (p) => new Promise((resolve) => (resolvers[p ?? 'all'] = resolve)),
    );

    const client = renderBand('both');

    // Both calls are in flight before either has resolved (a serial fetch would only have made one).
    await waitFor(() => expect(getRecentNodeCounts).toHaveBeenCalledTimes(2));
    expect(getRecentNodeCounts.mock.calls.map((c) => c[0]).sort()).toEqual(['meshcore', 'meshtastic']);
    expect(screen.getByTestId('right-now-skeleton')).toBeTruthy();

    resolvers.meshtastic({ '2': 5 });
    resolvers.meshcore({ '2': 2 });
    await screen.findByTestId('right-now-tile-2');
    expect(screen.getByTestId('right-now-tile-2').textContent).toContain('7');
    expect(client.getQueryData(['nodes', 'recent-counts', 'meshtastic'])).toEqual({ '2': 5 });
    expect(client.getQueryData(['nodes', 'recent-counts', 'meshcore'])).toEqual({ '2': 2 });
  });

  it('shows a small inline error, keeping the rest of the page, when the counts fail', async () => {
    getRecentNodeCounts.mockReset();
    getRecentNodeCounts.mockRejectedValue(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderBand('meshtastic');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't load");
    expect(screen.getByTestId('page')).toBeTruthy();
    expect(screen.queryByTestId('right-now-skeleton')).toBeNull();
    spy.mockRestore();
  });
});
