import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { DeviceMetrics, ObservedNode } from '@/lib/models';

import { NodeActivityTable } from '@/components/NodeActivityTable';
import { MonitoredNodesTable } from './MonitoredNodesTable';
import { NodeSelector } from './NodeSelector';
import { NodeMiniChart } from './NodeMiniChart';
import { MonitoredNodesBatteryChart } from './MonitoredNodesBatteryChart';

// Capture the data each chart hands to recharts rather than asserting on SVG.
const chartData: { current: Array<Record<string, unknown>> } = { current: [] };
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: ({ data }: { data: Array<Record<string, unknown>>; children?: ReactNode }) => {
      chartData.current = data;
      return null;
    },
  };
});

vi.mock('@/hooks/api/useMultiNodeMetrics', () => ({
  useMultiNodeMetricsSuspense: () => ({ metricsMap: {} }),
}));

const cases: Array<[string, number | null, string]> = [
  ['a level', 87, '87%'],
  ['zero', 0, '0%'],
  ['powered (101)', 101, 'Powered'],
  ['missing', null, '—'],
];

function makeNode(battery_level: number | null): ObservedNode {
  return {
    internal_id: '00000000-0000-4000-8000-000000000001',
    meshtastic_node_id: 100,
    node_id_str: '!00000064',
    mac_addr: null,
    long_name: 'Long',
    short_name: 'SN',
    meshtastic_hw_model: null,
    meshtastic_public_key: null,
    last_heard: new Date('2026-04-21T12:00:00Z'),
    latest_position: null,
    latest_device_metrics: {
      battery_level,
      voltage: null,
      meshtastic_channel_utilization: null,
      meshtastic_air_util_tx: null,
      uptime_seconds: null,
      reported_time: new Date('2026-04-21T12:00:00Z'),
      logged_time: null,
    },
  } as ObservedNode;
}

describe.each(cases)('battery text displays: %s', (_label, raw, text) => {
  it('NodeActivityTable', () => {
    render(
      <MemoryRouter>
        <NodeActivityTable nodes={[makeNode(raw)]} />
      </MemoryRouter>
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('MonitoredNodesTable', () => {
    render(<MonitoredNodesTable nodes={[makeNode(raw)]} onRemoveNode={vi.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('NodeSelector', () => {
    render(<NodeSelector nodes={[makeNode(raw)]} onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});

describe('battery charts map through describeBattery', () => {
  const t0 = new Date('2026-04-21T10:00:00Z');
  const metric = (battery_level: number | null, minutes: number): DeviceMetrics => ({
    battery_level,
    voltage: 4,
    meshtastic_channel_utilization: null,
    meshtastic_air_util_tx: null,
    uptime_seconds: null,
    reported_time: new Date(t0.getTime() + minutes * 60_000),
    logged_time: null,
  });
  const metrics = [metric(87, 0), metric(0, 1), metric(101, 2), metric(null, 3)];
  const range = { startDate: t0, endDate: new Date(t0.getTime() + 3_600_000) };

  it('NodeMiniChart plots 87 and 0, and leaves a gap for 101 and missing', () => {
    render(<NodeMiniChart metrics={metrics} dateRange={range} lines="battery" />);
    expect(chartData.current.map((d) => d.battery_level)).toEqual([87, 0, null, null]);
  });

  it('MonitoredNodesBatteryChart percent mode plots 87 and 0, and leaves a gap for 101 and missing', () => {
    render(
      <MonitoredNodesBatteryChart
        nodes={[makeNode(87)]}
        metricsMap={{ 100: metrics }}
        metricsQueryNodes={[makeNode(87)]}
        dateRange={range}
        hideTimeRangePicker
      />
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(chartData.current.map((d) => d['SN'])).toEqual([87, 0, null, null]);
  });
});
