import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import L from 'leaflet';
import { TracerouteMap } from './TracerouteMap';
import type { AutoTraceRoute, ManagedNode, ObservedNode } from '@/lib/models';

function makeSource(): ManagedNode {
  return {
    meshtastic_node_id: 1,
    long_name: 'Source',
    short_name: 'SRC',
    last_heard: null,
    node_id_str: '!00000001',
    owner: { id: 1, username: 'me' },
    constellation: { id: 1, name: 'C1' },
    allow_auto_traceroute: true,
    position: { latitude: 55.86, longitude: -4.25 },
  };
}

function makeTarget(): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 2,
    node_id_str: '!00000002',
    mac_addr: null,
    long_name: 'Target',
    short_name: 'TGT',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    latest_position: { latitude: 55.87, longitude: -4.26 },
  } as ObservedNode;
}

function makeTraceroute(
  status: AutoTraceRoute['status'],
  overrides: Partial<AutoTraceRoute> = {}
): AutoTraceRoute {
  return {
    id: 1,
    source_node: makeSource(),
    target_node: makeTarget(),
    trigger_type: 1,
    trigger_type_label: 'User',
    triggered_by: 1,
    triggered_by_username: 'me',
    trigger_source: null,
    triggered_at: new Date().toISOString(),
    status,
    route: null,
    route_back: null,
    route_nodes: [],
    route_back_nodes: [],
    raw_packet: null,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    error_message: null,
    ...overrides,
  };
}

type PolylineArgs = [L.LatLngExpression[], L.PolylineOptions | undefined];

describe('TracerouteMap polyline styling by status', () => {
  const polylineCalls: PolylineArgs[] = [];
  let polylineSpy: { mockRestore: () => void };

  beforeEach(() => {
    polylineCalls.length = 0;
    // L.polyline returns a Leaflet layer; for these tests we only need to
    // capture the options argument, so we stub out the return value.
    polylineSpy = vi
      .spyOn(L, 'polyline')
      .mockImplementation(((latlngs: L.LatLngExpression[], options?: L.PolylineOptions) => {
        polylineCalls.push([latlngs, options]);
        return {
          addTo: () => ({ remove: () => {} }),
          remove: () => {},
        } as unknown as L.Polyline;
      }) as unknown as typeof L.polyline);
  });

  afterEach(() => {
    polylineSpy.mockRestore();
  });

  function polylineOptionsForClass(className: string): L.PolylineOptions | undefined {
    const call = polylineCalls.find(([, opts]) => opts?.className === className);
    return call?.[1];
  }

  it('pending TR draws a dashed blue direct line (distinct from completed direct)', () => {
    render(<TracerouteMap traceroute={makeTraceroute('pending')} />);
    const opts = polylineOptionsForClass('traceroute-pending');
    expect(opts).toBeDefined();
    expect(opts?.color).toBe('#2563eb');
    expect(opts?.dashArray).toBe('4, 8');
    // Completed-direct line must not also be drawn when status is pending.
    expect(polylineOptionsForClass('traceroute-direct-completed')).toBeUndefined();
  });

  it('sent TR uses the same pending style (dashed blue)', () => {
    render(<TracerouteMap traceroute={makeTraceroute('sent')} />);
    const opts = polylineOptionsForClass('traceroute-pending');
    expect(opts).toBeDefined();
    expect(opts?.dashArray).toBe('4, 8');
    expect(opts?.color).toBe('#2563eb');
  });

  it('failed TR draws a dashed red direct line (unchanged)', () => {
    render(<TracerouteMap traceroute={makeTraceroute('failed')} />);
    const opts = polylineOptionsForClass('traceroute-failed');
    expect(opts).toBeDefined();
    expect(opts?.color).toBe('#dc2626');
    expect(opts?.dashArray).toBe('10, 8');
  });

  it('completed direct (0-hop) TR draws a SOLID blue line (unchanged)', () => {
    render(<TracerouteMap traceroute={makeTraceroute('completed')} />);
    const opts = polylineOptionsForClass('traceroute-direct-completed');
    expect(opts).toBeDefined();
    expect(opts?.color).toBe('#2563eb');
    // Solid = no dashArray set
    expect(opts?.dashArray).toBeUndefined();
    // Pending/failed direct lines must not be drawn when completed.
    expect(polylineOptionsForClass('traceroute-pending')).toBeUndefined();
    expect(polylineOptionsForClass('traceroute-failed')).toBeUndefined();
  });
});
