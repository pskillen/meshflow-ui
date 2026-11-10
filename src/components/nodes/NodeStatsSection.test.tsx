import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ObservedNode } from '@/lib/models';
import { statsRangeWindow } from '@/lib/stats-range';
import type { StatsRange } from '@/hooks/useStatsRange';
import { NodeStatsSection } from './NodeStatsSection';

const rangeMock = vi.hoisted(
  () =>
    (testId: string) =>
    ({ range }: { range?: StatsRange }) => <div data-testid={testId} data-range={range?.key} />
);

vi.mock('@/components/nodes/ChannelAirChart', () => ({ ChannelAirChart: rangeMock('channel-air-chart') }));
vi.mock('@/components/BatteryChartShadcn', () => ({ BatteryChartShadcn: rangeMock('battery-chart') }));
vi.mock('@/components/nodes/EnvironmentMetricsChart', () => ({ EnvironmentMetricsChart: rangeMock('env-chart') }));
vi.mock('@/components/nodes/PowerMetricsChart', () => ({ PowerMetricsChart: rangeMock('power-chart') }));
vi.mock('@/components/PacketTypeChart', () => ({ PacketTypeChart: rangeMock('packet-chart') }));
vi.mock('@/components/ReceivedPacketTypeChart', () => ({ ReceivedPacketTypeChart: rangeMock('received-chart') }));
vi.mock('@/components/nodes/NeighbourSourceBars', () => ({ NeighbourSourceBars: rangeMock('neighbour-chart') }));

const node = { meshtastic_node_id: 100, latest_environment_metrics: null, latest_power_metrics: null } as ObservedNode;

function rangeAt(now: Date): StatsRange {
  return { key: '7d', longLabel: 'last 7 days', window: statsRangeWindow('7d', now) } as StatsRange;
}

describe('NodeStatsSection', () => {
  it('gives the packet charts the page range, and the received chart only for managed nodes', () => {
    const range = rangeAt(new Date('2026-11-10T09:37:00Z'));
    const { rerender } = render(<NodeStatsSection internalId="x" node={node} isManagedNode range={range} />);
    expect(screen.getByTestId('packet-chart').getAttribute('data-range')).toBe('7d');
    expect(screen.getByTestId('received-chart').getAttribute('data-range')).toBe('7d');
    rerender(<NodeStatsSection internalId="x" node={node} isManagedNode={false} range={range} />);
    expect(screen.queryByTestId('received-chart')).toBeNull();
    expect(screen.getByTestId('packet-chart')).toBeTruthy();
  });

  it('keeps "Heard most from" behind a click for managed nodes only, and gives it the range', () => {
    const range = rangeAt(new Date('2026-11-10T09:37:00Z'));
    const { rerender } = render(<NodeStatsSection internalId="x" node={node} isManagedNode range={range} />);
    expect(screen.queryByTestId('neighbour-chart')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Heard most from/ }));
    expect(screen.getByTestId('neighbour-chart').getAttribute('data-range')).toBe('7d');
    rerender(<NodeStatsSection internalId="x" node={node} isManagedNode={false} range={range} />);
    expect(screen.queryByRole('button', { name: /Heard most from/ })).toBeNull();
  });
});
