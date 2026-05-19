import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GeoClassification, ManagedNode, ObservedNode } from '@/lib/models';
import { AutoTargetPreviewMap } from './AutoTargetPreviewMap';

vi.mock('@/components/map/DeckMapboxMap', () => ({
  DeckMapboxMap: ({ 'data-testid': tid }: { 'data-testid'?: string }) => (
    <div data-testid={tid ?? 'mock-deck'}>deck</div>
  ),
}));

function sampleGeo(overrides: Partial<GeoClassification> = {}): GeoClassification {
  return {
    tier: 'perimeter',
    bearing_octant: 'N',
    applicable_strategies: ['intra_zone', 'dx_across', 'dx_same_side'],
    envelope: { centroid_lat: 55.0, centroid_lon: -4.25, radius_km: 12 },
    selection_centroid: { lat: 55.0, lon: -4.25 },
    source_bearing_deg: 90,
    selector_params: {
      last_heard_within_hours: 3,
      dx_half_window_sweep_deg: [45, 60, 75, 90],
      perimeter_distance_fraction: 0.6,
    },
    ...overrides,
  };
}

function makeFeeder(overrides: Partial<ManagedNode> = {}): ManagedNode {
  return {
    meshtastic_node_id: 7,
    long_name: 'Source',
    short_name: 'SRC',
    last_heard: null,
    node_id_str: '!00000007',
    owner: { id: 1, username: 'me' },
    constellation: { id: 1, name: 'C1' },
    allow_auto_traceroute: true,
    position: { latitude: 55.2, longitude: -4.25 },
    geo_classification: sampleGeo(),
    ...overrides,
  } as ManagedNode;
}

const now = new Date();
const candidate: ObservedNode = {
  internal_id: 1,
  meshtastic_node_id: 99,
  node_id_str: '!00000063',
  mac_addr: null,
  long_name: 'Obs',
  short_name: 'O',
  hw_model: null,
  public_key: null,
  last_heard: now,
  latest_position: {
    latitude: 55.05,
    longitude: -4.25,
    reported_time: now,
    logged_time: now,
    altitude: null,
    location_source: 'gps',
  },
} as ObservedNode;

describe('AutoTargetPreviewMap', () => {
  it('shows unavailable when selector_params is missing', () => {
    const feeder = makeFeeder({
      geo_classification: {
        tier: 'perimeter',
        bearing_octant: null,
        applicable_strategies: ['dx_across'],
      } as GeoClassification,
    });
    render(
      <AutoTargetPreviewMap
        feeder={feeder}
        candidates={[candidate]}
        managedNodeIds={new Set()}
        strategy="auto"
        halfWindowDeg={45}
      />
    );
    expect(screen.getByTestId('auto-target-preview-unavailable')).toBeInTheDocument();
  });

  it('shows unavailable when feeder has no position', () => {
    const feeder = makeFeeder({
      position: { latitude: null, longitude: null },
    });
    render(
      <AutoTargetPreviewMap
        feeder={feeder}
        candidates={[candidate]}
        managedNodeIds={new Set()}
        strategy="auto"
        halfWindowDeg={45}
      />
    );
    expect(screen.getByTestId('auto-target-preview-unavailable')).toBeInTheDocument();
  });

  it('renders map shell and legend when geo data is complete', () => {
    render(
      <AutoTargetPreviewMap
        feeder={makeFeeder()}
        candidates={[candidate]}
        managedNodeIds={new Set()}
        strategy="auto"
        halfWindowDeg={45}
      />
    );
    expect(screen.getByTestId('auto-target-preview-map')).toBeInTheDocument();
    expect(screen.getByTestId('auto-target-preview-deck')).toBeInTheDocument();
    expect(screen.getByText('Intra-zone')).toBeInTheDocument();
    expect(screen.getByText('DX across')).toBeInTheDocument();
  });
});
