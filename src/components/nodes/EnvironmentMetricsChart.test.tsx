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

const envHook = vi.fn();
vi.mock('@/hooks/api/useNodes', () => ({
  useNodeEnvironmentMetricsSuspense: (...args: unknown[]) => envHook(...args),
}));

import { EnvironmentMetricsChart } from '@/components/nodes/EnvironmentMetricsChart';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow } from '@/lib/stats-range';

const def = STATS_RANGES['30d'];
const range: StatsRange = {
  key: '30d',
  def,
  label: def.label,
  longLabel: def.longLabel,
  bucket: def.bucket,
  bucketLabel: def.bucketLabel,
  window: statsRangeWindow('30d', new Date('2026-11-09T14:30:00Z')),
  options: ['24h', '7d', '30d', '90d'],
  setRange: () => {},
};

const row = (d: number, over: Record<string, number | null>) => ({
  node: 1,
  reported_time: new Date(Date.UTC(2026, 10, d)),
  samples: 2,
  temperature: null,
  relative_humidity: null,
  barometric_pressure: null,
  ...over,
});

describe('EnvironmentMetricsChart', () => {
  beforeEach(() => envHook.mockReset());

  it('sends the 1d bucket for 30d and makes one card per reading the node has', () => {
    envHook.mockReturnValue({
      metrics: [
        row(5, { temperature: 11.2, relative_humidity: 80 }),
        row(6, { temperature: 12.1, relative_humidity: 78 }),
      ],
    });
    render(<EnvironmentMetricsChart internalId="n1" range={range} />);
    expect((envHook.mock.calls[0]![1] as { bucket: string }).bucket).toBe('1d');
    expect(screen.getByTestId('chart-node-env-temperature-headline').textContent).toBe('12.1 °C');
    expect(screen.getByTestId('chart-node-env-relative_humidity-headline').textContent).toBe('78 %');
    expect(screen.queryByTestId('chart-node-env-barometric_pressure')).toBeNull();
  });

  it('says so when no environment reading falls in the range', () => {
    envHook.mockReturnValue({ metrics: [] });
    render(<EnvironmentMetricsChart internalId="n1" range={range} />);
    expect(screen.getByTestId('chart-node-environment-empty-empty').textContent).toMatch(/No environment readings/);
  });
});
