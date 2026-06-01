import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MeshCorePathEdgeBucket, MeshCorePathSegment } from '@/lib/models';
import {
  useAnnotatePathSegment,
  usePathTracingEdges,
  usePathTracingSegments,
} from '@/hooks/api/usePathTracing';
import { MeshCorePassivePath } from './MeshCorePassivePath';

const getCurrentUser = vi.fn();

vi.mock('@/lib/auth/authService', () => ({
  authService: {
    getCurrentUser: () => getCurrentUser(),
  },
}));

vi.mock('@/hooks/api/usePathTracing', () => ({
  usePathTracingSegments: vi.fn(),
  usePathTracingEdges: vi.fn(),
  useAnnotatePathSegment: vi.fn(),
}));

const usePathTracingSegmentsMock = vi.mocked(usePathTracingSegments);
const usePathTracingEdgesMock = vi.mocked(usePathTracingEdges);
const useAnnotatePathSegmentMock = vi.mocked(useAnnotatePathSegment);

const emptyPage = { count: 0, next: null, previous: null, results: [] as MeshCorePathSegment[] };
const emptyEdges = { count: 0, next: null, previous: null, results: [] as MeshCorePathEdgeBucket[] };

const sampleSegment: MeshCorePathSegment = {
  id: 'seg-1',
  segment_hash: 'aabb',
  hash_size: 2,
  hash_mode: 0,
  status: 'unknown',
  source: 'rollup',
  resolver_version: 0,
  confidence: null,
  observed_node: null,
  first_seen_at: '2026-06-01T10:00:00Z',
  last_seen_at: '2026-06-01T12:00:00Z',
};

const sampleEdge: MeshCorePathEdgeBucket = {
  id: 'edge-1',
  bucket_start: '2026-06-01T09:00:00Z',
  bucket_size: '1h',
  from_kind: 'hash',
  to_kind: 'hash',
  from_hash: 'aa',
  to_hash: 'bb',
  observer: 'obs-uuid',
  observer_name: 'Feeder A',
  constellation: null,
  constellation_name: null,
  packet_count: 3,
  observation_count: 5,
  first_seen_at: '2026-06-01T09:05:00Z',
  last_seen_at: '2026-06-01T09:55:00Z',
  avg_snr: 4.5,
  min_snr: 2,
  max_snr: 7,
  direction: 'list_order',
  resolved: false,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MeshCorePassivePath />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MeshCorePassivePath', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockReturnValue({ id: 1, username: 'staff', is_staff: true });
    usePathTracingSegmentsMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { ...emptyPage, count: 1, results: [sampleSegment] },
    } as ReturnType<typeof usePathTracingSegments>);
    usePathTracingEdgesMock.mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      error: null,
      data: { ...emptyEdges, count: 1, results: [sampleEdge] },
    } as ReturnType<typeof usePathTracingEdges>);
    useAnnotatePathSegmentMock.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useAnnotatePathSegment>);
  });

  it('renders preview title and segment/edge rows', () => {
    renderPage();
    expect(screen.getByText(/Passive path tracing \(preview\)/i)).toBeInTheDocument();
    expect(screen.getByText('aabb')).toBeInTheDocument();
    expect(screen.getByText('list_order')).toBeInTheDocument();
    expect(screen.getByText(/aa → bb/)).toBeInTheDocument();
  });

  it('passes segment filters into the segments query hook', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByTestId('segment-filter-hash-mode'), '1');
    await waitFor(() => {
      const lastCall = usePathTracingSegmentsMock.mock.calls.at(-1)?.[0];
      expect(lastCall?.hash_mode).toBe(1);
    });
  });

  it('shows staff annotate panel for staff', () => {
    renderPage();
    expect(screen.getByTestId('staff-annotate-panel')).toBeInTheDocument();
  });

  it('hides staff annotate panel for non-staff', () => {
    getCurrentUser.mockReturnValue({ id: 2, username: 'user', is_staff: false });
    renderPage();
    expect(screen.queryByTestId('staff-annotate-panel')).not.toBeInTheDocument();
  });

  it('submits staff annotation via mutation', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue(sampleSegment);
    renderPage();
    await user.type(screen.getByTestId('annotate-segment-id'), 'seg-1');
    await user.type(screen.getByTestId('annotate-node-id-str'), 'mc:abc');
    await user.click(screen.getByTestId('annotate-submit'));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        segmentId: 'seg-1',
        body: { node_id_str: 'mc:abc', status: 'resolved' },
      });
    });
  });
});
