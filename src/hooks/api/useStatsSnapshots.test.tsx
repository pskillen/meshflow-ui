import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStatsSnapshotsForTypes } from './useStatsSnapshots';

const api = { getStatsSnapshots: vi.fn() };
vi.mock('./useApi', () => ({ useMeshtasticApi: () => api }));

const params = {
  recordedAtAfter: new Date('2026-11-01T00:00:00Z'),
  recordedAtBefore: new Date('2026-11-02T00:00:00Z'),
  bucket: '1d' as const,
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useStatsSnapshotsForTypes', () => {
  beforeEach(() => {
    api.getStatsSnapshots.mockReset();
  });

  it('leaves pages undefined until every stat type has loaded, then keys them by type', async () => {
    let releaseMc: (v: unknown) => void = () => {};
    api.getStatsSnapshots.mockImplementation(({ statType }: { statType: string }) =>
      statType === 'mc_packet_volume'
        ? new Promise((resolve) => (releaseMc = resolve))
        : Promise.resolve({ count: 0, results: [], tag: statType })
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useStatsSnapshotsForTypes(['packet_volume', 'mc_packet_volume'], params), {
      wrapper,
    });
    await waitFor(() => expect(api.getStatsSnapshots).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.pages).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    releaseMc({ count: 0, results: [], tag: 'mc_packet_volume' });
    await waitFor(() => expect(result.current.pages).toBeDefined());
    expect(Object.keys(result.current.pages!)).toEqual(['packet_volume', 'mc_packet_volume']);
    expect((result.current.pages!.packet_volume as unknown as { tag: string }).tag).toBe('packet_volume');
  });

  it('uses the shared stats-snapshots cache keys and does not poll', async () => {
    api.getStatsSnapshots.mockResolvedValue({ count: 0, results: [] });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useStatsSnapshotsForTypes(['packet_volume'], params), { wrapper });
    await waitFor(() => expect(result.current.pages).toBeDefined());
    const queries = client.getQueryCache().getAll();
    expect(queries).toHaveLength(1);
    expect(queries[0].queryKey[0]).toBe('stats-snapshots');
    expect(String(queries[0].queryKey[1])).toContain('packet_volume');
    expect(queries[0].observers[0].options.refetchInterval).toBeUndefined();
  });
});
