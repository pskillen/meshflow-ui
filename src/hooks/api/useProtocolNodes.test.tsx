import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProtocolObservedNodesSuspense } from './useProtocolNodes';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';

const api = { getObservedNodes: vi.fn() };
vi.mock('./useApi', () => ({ useMeshflowApi: () => api }));

const config = { slug: 'meshtastic' } as ProtocolPageConfig;

function makePage(ids: string[], next: string | null) {
  return { count: 3, next, previous: null, results: ids.map((id) => ({ internal_id: id })) };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
}

describe('useProtocolObservedNodesSuspense', () => {
  beforeEach(() => {
    api.getObservedNodes.mockReset();
    api.getObservedNodes.mockImplementation(async ({ page }: { page: number }) =>
      page === 1 ? makePage(['a'], 'next') : page === 2 ? makePage(['b'], 'next') : makePage(['c'], null)
    );
  });

  it('requests one page until fetchNextPage is called', async () => {
    const { result } = renderHook(() => useProtocolObservedNodesSuspense(config, { pageSize: 1 }), { wrapper });
    await waitFor(() => expect(result.current?.nodes).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(api.getObservedNodes).toHaveBeenCalledTimes(1);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.totalNodes).toBe(3);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(api.getObservedNodes).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.nodes).toHaveLength(2));
  });
});
