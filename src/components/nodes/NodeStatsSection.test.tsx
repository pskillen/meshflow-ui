import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ObservedNode } from '@/lib/models';
import { statsRangeWindow } from '@/lib/stats-range';
import type { StatsRange } from '@/hooks/useStatsRange';
import { NodeStatsSection } from './NodeStatsSection';

const chartMock = vi.hoisted(
  () =>
    (testId: string) =>
    ({ controlledDateRange }: { controlledDateRange: { startDate: Date; endDate: Date } }) => (
      <div
        data-testid={testId}
        data-start={controlledDateRange.startDate.toISOString()}
        data-end={controlledDateRange.endDate.toISOString()}
      />
    )
);

vi.mock('@/components/BatteryChartShadcn', () => ({ BatteryChartShadcn: chartMock('battery-chart') }));
vi.mock('@/components/nodes/EnvironmentMetricsChart', () => ({ EnvironmentMetricsChart: chartMock('env-chart') }));
vi.mock('@/components/nodes/PowerMetricsChart', () => ({ PowerMetricsChart: chartMock('power-chart') }));
vi.mock('@/components/PacketTypeChart', () => ({ PacketTypeChart: chartMock('packet-chart') }));
vi.mock('@/components/ReceivedPacketTypeChart', () => ({ ReceivedPacketTypeChart: chartMock('received-chart') }));
vi.mock('@/components/NeighbourPieChart', () => ({ NeighbourPieChart: chartMock('neighbour-chart') }));

const node = { meshtastic_node_id: 100, latest_environment_metrics: null, latest_power_metrics: null } as ObservedNode;

function rangeAt(now: Date): StatsRange {
  return { key: '7d', longLabel: 'last 7 days', window: statsRangeWindow('7d', now) } as StatsRange;
}

describe('NodeStatsSection', () => {
  it('asks the old charts for data up to at least now, not just the top of the hour', () => {
    const now = new Date('2026-11-10T09:37:00Z');
    render(<NodeStatsSection internalId="x" node={node} isManagedNode={false} range={rangeAt(now)} />);
    const end = new Date(screen.getByTestId('battery-chart').getAttribute('data-end')!);
    expect(end.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(screen.getByTestId('packet-chart').getAttribute('data-end')).toBe(end.toISOString());
  });

  it('keeps the start of the window unchanged', () => {
    const now = new Date('2026-11-10T09:37:00Z');
    const range = rangeAt(now);
    render(<NodeStatsSection internalId="x" node={node} isManagedNode={false} range={range} />);
    expect(screen.getByTestId('battery-chart').getAttribute('data-start')).toBe(range.window.start.toISOString());
  });
});
