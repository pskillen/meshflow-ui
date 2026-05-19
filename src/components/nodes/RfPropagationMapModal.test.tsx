import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RfPropagationMapModal } from './RfPropagationMapModal';

const useRfPropagation = vi.fn();
vi.mock('@/hooks/api/useRfPropagation', () => ({
  useRfProfile: vi.fn(),
  useRfPropagation: (...a: unknown[]) => useRfPropagation(...a),
  useUpdateRfProfile: vi.fn(),
  useRecomputeRfPropagation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

describe('RfPropagationMapModal', () => {
  it('shows empty state when propagation is not ready', () => {
    useRfPropagation.mockReturnValue({
      data: { status: 'pending', created_at: '2026-01-01' },
      isLoading: false,
    });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <RfPropagationMapModal open onOpenChange={() => {}} internalId="00000000-0000-4000-8000-000000000001" />
      </QueryClientProvider>
    );
    expect(screen.getByText(/map not rendered yet/i)).toBeInTheDocument();
  });

  it('does not enable propagation fetch when assetUrl and bounds are passed', () => {
    useRfPropagation.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <RfPropagationMapModal
          open
          onOpenChange={() => {}}
          assetUrl="https://example.com/m.png"
          bounds={{ west: -1, south: 50, east: 1, north: 52 }}
          layout="maximised"
        />
      </QueryClientProvider>
    );
    expect(useRfPropagation).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ enabled: false })
    );
    expect(screen.getByRole('dialog').querySelector('.map-container')).not.toBeNull();
  });
});
