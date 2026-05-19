import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { TriggerTracerouteModal } from './TriggerTracerouteModal';
import type { GeoClassification, ManagedNode, ObservedNode } from '@/lib/models';

vi.mock('@/providers/ConfigProvider', () => ({
  useConfig: () => ({ apis: { meshBot: { baseUrl: 'https://api.example' } } }),
}));

vi.mock('@/hooks/api/useNodes', () => ({
  useNodes: () => ({
    searchNodes: vi.fn(),
    searchResults: [],
    isSearching: false,
  }),
}));

vi.mock('@/components/traceroutes/AutoTargetPreviewMap', () => ({
  AutoTargetPreviewMap: () => <div data-testid="auto-target-preview-stub" />,
}));

function makeObservedNode(overrides: Partial<ObservedNode> = {}): ObservedNode {
  return {
    internal_id: 1,
    meshtastic_node_id: 42,
    node_id_str: '!0000002a',
    mac_addr: null,
    long_name: 'Fixed target',
    short_name: 'FIX',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    ...overrides,
  };
}

function sampleGeo(): GeoClassification {
  return {
    tier: 'perimeter',
    bearing_octant: 'N',
    applicable_strategies: ['intra_zone', 'dx_across', 'dx_same_side'],
    envelope: { centroid_lat: 55.0, centroid_lon: -4.25, radius_km: 10 },
    selection_centroid: { lat: 55.0, lon: -4.25 },
    source_bearing_deg: 90,
    selector_params: {
      last_heard_within_hours: 3,
      dx_half_window_sweep_deg: [45, 60, 75, 90],
      perimeter_distance_fraction: 0.6,
    },
  };
}

function makeManagedNode(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 7,
    long_name: 'Source',
    short_name: 'SRC',
    last_heard: null,
    last_packet_ingested_at: new Date('2026-01-01T00:00:00Z'),
    node_id_str: '!00000007',
    owner: { id: 1, username: 'me' },
    constellation: { id: 1, name: 'C1' },
    allow_auto_traceroute: true,
    position: { latitude: null, longitude: null },
    ...overrides,
  };
}

describe('TriggerTracerouteModal with fixedTargetNode', () => {
  it('renders a read-only target row and source-selection map (no NodeSearch) when fixedTargetNode is set', () => {
    const fixed = makeObservedNode();
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="user"
        managedNodes={[makeManagedNode()]}
        observedNodes={[fixed]}
        onTrigger={vi.fn().mockResolvedValue(undefined)}
        isSubmitting={false}
        fixedTargetNode={fixed}
      />
    );

    const readOnly = screen.getByTestId('trigger-traceroute-fixed-target');
    expect(readOnly).toHaveTextContent('FIX (!0000002a)');
    expect(screen.queryByPlaceholderText(/search.*node/i)).not.toBeInTheDocument();
    expect(screen.getByText(/pick a source on the map/i)).toBeInTheDocument();
    // Dialog renders via a Radix portal, so query the whole document.
    expect(document.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('uses the fixed-target variant of the description and shows a Trigger button', () => {
    const fixed = makeObservedNode();
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="user"
        managedNodes={[makeManagedNode()]}
        observedNodes={[fixed]}
        onTrigger={vi.fn().mockResolvedValue(undefined)}
        isSubmitting={false}
        fixedTargetNode={fixed}
      />
    );

    expect(screen.getByText(/target is fixed to the node you are viewing/i)).toBeInTheDocument();
    // The Trigger button is disabled until a source is chosen, proving the
    // target is pre-populated (otherwise it would be disabled on two conditions).
    const trigger = screen.getByRole('button', { name: /^trigger$/i });
    expect(trigger).toBeDisabled();
  });

  it('shows target strategy selector in auto mode', () => {
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="auto"
        managedNodes={[makeManagedNode()]}
        observedNodes={[]}
        onTrigger={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(screen.getByTestId('trigger-traceroute-strategy')).toBeInTheDocument();
  });

  it('does not show target strategy selector in pick-target mode', () => {
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="user"
        managedNodes={[makeManagedNode({ geo_classification: sampleGeo() })]}
        observedNodes={[makeObservedNode()]}
        onTrigger={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(screen.queryByTestId('trigger-traceroute-strategy')).not.toBeInTheDocument();
  });

  it('does not show target strategy selector for fixed-target flow', () => {
    const fixed = makeObservedNode();
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="user"
        managedNodes={[makeManagedNode({ geo_classification: sampleGeo() })]}
        observedNodes={[fixed]}
        onTrigger={vi.fn()}
        isSubmitting={false}
        fixedTargetNode={fixed}
      />
    );
    expect(screen.queryByTestId('trigger-traceroute-strategy')).not.toBeInTheDocument();
  });

  it('shows auto-target preview after selecting a source in auto mode', async () => {
    const user = userEvent.setup();
    const managed = makeManagedNode({
      position: { latitude: 55.2, longitude: -4.25 },
      geo_classification: sampleGeo(),
    });
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="auto"
        managedNodes={[managed]}
        observedNodes={[]}
        onTrigger={vi.fn()}
        isSubmitting={false}
      />
    );
    await user.click(screen.getByLabelText('Source node'));
    const opt = await screen.findByRole('option', { name: /SRC/, hidden: true });
    await user.click(opt);
    expect(screen.getByTestId('auto-target-preview-stub')).toBeInTheDocument();
    expect(screen.getByText(/DX half-window/i)).toBeInTheDocument();
  });

  it('does not render the fixed-target row when fixedTargetNode is omitted', () => {
    // NodeSearch pulls in the nodes API; render the auto mode to avoid that
    // while still verifying the fixed-target UI is absent.
    render(
      <TriggerTracerouteModal
        open={true}
        onOpenChange={vi.fn()}
        mode="auto"
        managedNodes={[makeManagedNode()]}
        observedNodes={[]}
        onTrigger={vi.fn().mockResolvedValue(undefined)}
        isSubmitting={false}
      />
    );
    expect(screen.queryByTestId('trigger-traceroute-fixed-target')).not.toBeInTheDocument();
  });
});
