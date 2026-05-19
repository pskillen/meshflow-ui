import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ObservedNode } from '@/lib/models';
import { RfProfileModal } from './RfProfileModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock('@/hooks/useMapTileUrl', () => ({
  useMapTileUrl: () => ({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'OSM',
  }),
}));

const useRfProfile = vi.fn();
const useUpdateRfProfile = vi.fn();
const useRecomputeRfPropagation = vi.fn();

vi.mock('@/hooks/api/useRfPropagation', () => ({
  useRfProfile: (...a: unknown[]) => useRfProfile(...a),
  useUpdateRfProfile: (...a: unknown[]) => useUpdateRfProfile(...a),
  useRecomputeRfPropagation: (...a: unknown[]) => useRecomputeRfPropagation(...a),
}));

function makeNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 55,
    node_id_str: '!00000037',
    mac_addr: null,
    long_name: 'N',
    short_name: 'N',
    hw_model: null,
    public_key: null,
    role: 2,
    last_heard: null,
    latest_position: {
      latitude: 12.34,
      longitude: 56.78,
      altitude: 90,
      logged_time: null,
      reported_time: null,
    },
    ...overrides,
  } as ObservedNode;
}

function renderModal(node: ObservedNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: ReactElement = (
    <QueryClientProvider client={client}>
      <RfProfileModal open node={node} onOpenChange={() => {}} />
    </QueryClientProvider>
  );
  return render(ui);
}

describe('RfProfileModal', () => {
  beforeEach(() => {
    useUpdateRfProfile.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });
    useRecomputeRfPropagation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });
  });

  it('Copy from GPS fills lat/lng/alt from latest_position', async () => {
    useRfProfile.mockReturnValue({
      data: { antenna_pattern: 'omni', rf_latitude: 0, rf_longitude: 0, rf_altitude_m: 0 },
      isLoading: false,
    });
    renderModal(makeNode());
    await userEvent.click(screen.getByRole('button', { name: /copy from gps/i }));
    const latInput = screen.getByLabelText(/latitude/i) as HTMLInputElement;
    const lngInput = screen.getByLabelText(/longitude/i) as HTMLInputElement;
    const altInput = screen.getByLabelText(/altitude/i) as HTMLInputElement;
    expect(latInput.value).toContain('12.34');
    expect(lngInput.value).toContain('56.78');
    expect(altInput.value).toContain('90');
  });

  it('closes profile dialog after save and opens re-render confirm when coords changed', async () => {
    const onOpenChange = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateRfProfile.mockReturnValue({ mutateAsync, isPending: false });
    useRfProfile.mockReturnValue({
      data: {
        antenna_pattern: 'omni',
        rf_latitude: 1,
        rf_longitude: 2,
        rf_altitude_m: 3,
        rf_frequency_mhz: 868,
      },
      isLoading: false,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RfProfileModal open node={makeNode()} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );
    const latInput = screen.getByLabelText(/latitude/i);
    await userEvent.clear(latInput);
    await userEvent.type(latInput, '9.5');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('heading', { name: /re-render propagation map/i })).toBeInTheDocument();
  });

  it('does not open re-render confirm when coords unchanged', async () => {
    const onOpenChange = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateRfProfile.mockReturnValue({ mutateAsync, isPending: false });
    useRfProfile.mockReturnValue({
      data: {
        antenna_pattern: 'omni',
        rf_latitude: 12.34,
        rf_longitude: 56.78,
        rf_altitude_m: 90,
        rf_frequency_mhz: 868,
      },
      isLoading: false,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RfProfileModal open node={makeNode()} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('heading', { name: /re-render propagation map/i })).not.toBeInTheDocument();
  });

  it('queues render when confirm Yes is clicked', async () => {
    const onOpenChange = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({});
    const recomputeAsync = vi.fn().mockResolvedValue({});
    useUpdateRfProfile.mockReturnValue({ mutateAsync, isPending: false });
    useRecomputeRfPropagation.mockReturnValue({ mutateAsync: recomputeAsync, isPending: false });
    useRfProfile.mockReturnValue({
      data: {
        antenna_pattern: 'omni',
        rf_latitude: 1,
        rf_longitude: 2,
        rf_altitude_m: 3,
        rf_frequency_mhz: 868,
      },
      isLoading: false,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RfProfileModal open node={makeNode()} onOpenChange={onOpenChange} />
      </QueryClientProvider>
    );
    await userEvent.clear(screen.getByLabelText(/latitude/i));
    await userEvent.type(screen.getByLabelText(/latitude/i), '9.5');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /yes, queue render/i }));
    await waitFor(() => expect(recomputeAsync).toHaveBeenCalled());
  });

  it('shows frequency band selector and map container (omni-only UI)', async () => {
    useRfProfile.mockReturnValue({
      data: {
        antenna_pattern: 'directional',
        antenna_azimuth_deg: 10,
        antenna_beamwidth_deg: 30,
        rf_frequency_mhz: 868,
      },
      isLoading: false,
    });
    renderModal(makeNode());
    expect(screen.getByTestId('rf-profile-map')).toBeInTheDocument();
    expect(screen.queryByLabelText(/azimuth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/beamwidth/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /frequency/i })).toBeInTheDocument();
  });
});
