import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useObservedNodesHeard } from './useObservedNodesHeard';

const getNodes = vi.fn();
vi.mock('./useApi', () => ({ useMeshtasticApi: () => ({ getNodes }) }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const lastHeardAfter = new Date('2026-01-01T00:00:00Z');

describe('useObservedNodesHeard', () => {
  beforeEach(() => getNodes.mockReset());

  it('requests page 1 only at page_size 1000 and flags truncation', async () => {
    getNodes.mockResolvedValue({ count: 2500, next: 'http://x/?page=2', previous: null, results: [{ node_id: 1 }] });
    const { result } = renderHook(() => useObservedNodesHeard({ lastHeardAfter }), { wrapper });
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(getNodes).toHaveBeenCalledTimes(1);
    expect(getNodes).toHaveBeenCalledWith({ page: 1, page_size: 1000, last_heard_after: lastHeardAfter });
    expect(result.current.total).toBe(2500);
    expect(result.current.truncated).toBe(true);
  });

  it('is not truncated when everything fits on the page', async () => {
    getNodes.mockResolvedValue({ count: 1, next: null, previous: null, results: [{ node_id: 1 }] });
    const { result } = renderHook(() => useObservedNodesHeard({ lastHeardAfter }), { wrapper });
    await waitFor(() => expect(result.current.nodes).toHaveLength(1));
    expect(result.current.truncated).toBe(false);
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useObservedNodesHeard({ lastHeardAfter, enabled: false }), { wrapper });
    expect(getNodes).not.toHaveBeenCalled();
  });
});
