import { cloneElement, isValidElement, type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      isValidElement(children)
        ? cloneElement(children as ReactElement<{ width: number; height: number }>, { width: 800, height: 190 })
        : null,
  };
});

const powerHook = vi.fn();
vi.mock('@/hooks/api/useNodes', () => ({
  useNodePowerMetricsSuspense: (...args: unknown[]) => powerHook(...args),
}));

import { PowerMetricsChart } from '@/components/nodes/PowerMetricsChart';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow } from '@/lib/stats-range';

const def = STATS_RANGES['7d'];
const range: StatsRange = {
  key: '7d',
  def,
  label: def.label,
  longLabel: def.longLabel,
  bucket: def.bucket,
  bucketLabel: def.bucketLabel,
  window: statsRangeWindow('7d', new Date('2026-11-09T14:30:00Z')),
  options: ['24h', '7d', '30d', '90d'],
  setRange: () => {},
};

const row = (h: number, over: Record<string, number | null>) => ({
  node: 1,
  reported_time: new Date(Date.UTC(2026, 10, 5, h)),
  samples: 2,
  ...over,
});

describe('PowerMetricsChart', () => {
  beforeEach(() => powerHook.mockReset());

  it('sends the 6h bucket for 7d and keeps volts and amps on separate charts', () => {
    powerHook.mockReturnValue({
      metrics: [
        row(0, { ch1_voltage: 5.1, ch1_current: 0.4, ch2_voltage: 12 }),
        row(6, { ch1_voltage: 5, ch1_current: 0.5 }),
      ],
    });
    render(<PowerMetricsChart internalId="n1" range={range} />);
    expect((powerHook.mock.calls[0]![1] as { bucket: string }).bucket).toBe('6h');
    expect(screen.getByTestId('chart-node-power-voltage')).toBeTruthy();
    expect(screen.getByTestId('chart-node-power-current')).toBeTruthy();
    const volts = screen.getByTestId('chart-node-power-voltage').textContent ?? '';
    expect(volts).toMatch(/Channel 1/);
    expect(volts).toMatch(/Channel 2/);
  });

  it('shows one empty card when the node reported no power channels in the range', () => {
    powerHook.mockReturnValue({ metrics: [] });
    render(<PowerMetricsChart internalId="n1" range={range} />);
    expect(screen.getByTestId('chart-node-power-empty-empty').textContent).toMatch(/No power readings/);
  });
});
