import { cloneElement, isValidElement, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

const useNodeMetricsSuspense = vi.fn();
vi.mock('@/hooks/api/useNodes', () => ({
  useNodeMetricsSuspense: (...args: unknown[]) => useNodeMetricsSuspense(...args),
}));

import { BatteryChartShadcn } from '@/components/BatteryChartShadcn';
import { ChannelAirChart } from '@/components/nodes/ChannelAirChart';
import type { StatsRange } from '@/hooks/useStatsRange';
import { STATS_RANGES, statsRangeWindow, type StatsPresetKey } from '@/lib/stats-range';

const NOW = new Date('2026-11-09T14:30:00Z');

function rangeFor(key: StatsPresetKey): StatsRange {
  const def = STATS_RANGES[key];
  return {
    key,
    def,
    label: def.label,
    longLabel: def.longLabel,
    bucket: def.bucket,
    bucketLabel: def.bucketLabel,
    window: statsRangeWindow(key, NOW),
    options: ['24h', '7d', '30d', '90d'],
    setRange: () => {},
  };
}

const row = (d: number, over: Record<string, number | null>) => ({
  node: 1,
  reported_time: new Date(Date.UTC(2026, 10, d)),
  samples: 3,
  battery_level: null,
  voltage: null,
  meshtastic_channel_utilization: null,
  meshtastic_air_util_tx: null,
  uptime_seconds: null,
  ...over,
});

describe('BatteryChartShadcn', () => {
  beforeEach(() => useNodeMetricsSuspense.mockReset());

  it('asks for the bucket that matches the range, with the window and one extra hour at the end', () => {
    useNodeMetricsSuspense.mockReturnValue({ metrics: [] });
    for (const [key, bucket] of [
      ['24h', '1h'],
      ['7d', '6h'],
      ['30d', '1d'],
      ['90d', '1d'],
    ] as const) {
      const range = rangeFor(key);
      const { unmount } = render(<BatteryChartShadcn internalId="n1" range={range} />);
      const params = useNodeMetricsSuspense.mock.calls.at(-1)![1] as { bucket: string; endDate: Date; startDate: Date };
      expect(params.bucket).toBe(bucket);
      expect(params.startDate).toEqual(range.window.start);
      expect(params.endDate.getTime()).toBe(range.window.end.getTime() + 3_600_000);
      unmount();
    }
  });

  it('plots volts by default and says there is no voltage when none was reported', () => {
    useNodeMetricsSuspense.mockReturnValue({ metrics: [row(5, { voltage: 3.87, battery_level: 80 })] });
    const { unmount } = render(<BatteryChartShadcn internalId="n1" range={rangeFor('30d')} />);
    expect(screen.getByTestId('chart-node-battery-headline').textContent).toBe('3.87 V');
    expect(screen.getByTestId('trend-chart')).toBeTruthy();
    unmount();

    useNodeMetricsSuspense.mockReturnValue({ metrics: [row(5, { voltage: 0, battery_level: 0 })] });
    render(<BatteryChartShadcn internalId="n1" range={rangeFor('30d')} />);
    expect(screen.getByTestId('chart-node-battery-empty').textContent).toMatch(/No battery voltage/);
  });

  it('shows a raw 101 as Powered, not a 101% spike', () => {
    useNodeMetricsSuspense.mockReturnValue({
      metrics: [row(5, { voltage: 5.1, battery_level: 101 }), row(6, { voltage: 5.1, battery_level: 101 })],
    });
    render(<BatteryChartShadcn internalId="n1" range={rangeFor('30d')} defaultMode="percentage" />);
    expect(screen.getByTestId('chart-node-battery-empty').textContent).toMatch(/Powered/);
    expect(document.body.textContent).not.toMatch(/101/);
  });

  it('notes powered buckets when other buckets have a real level, and the toggle switches the reading', () => {
    useNodeMetricsSuspense.mockReturnValue({
      metrics: [row(5, { voltage: 3.9, battery_level: 88 }), row(6, { voltage: 5.1, battery_level: 101 })],
    });
    render(<BatteryChartShadcn internalId="n1" range={rangeFor('30d')} />);
    fireEvent.click(screen.getByRole('radio', { name: /percentage/i }));
    expect(screen.getByTestId('chart-node-battery-headline').textContent).toBe('Powered');
    expect(screen.getByTestId('chart-node-battery').textContent).toMatch(/Powered \(external supply\) in 1 bucket/);
    const table = screen.getByTestId('trend-chart-table').textContent ?? '';
    expect(table).not.toMatch(/101/);
    expect(table).toMatch(/88/);
  });
});

describe('ChannelAirChart', () => {
  beforeEach(() => useNodeMetricsSuspense.mockReset());

  it('is its own chart with percent series only, one dashed to tell them apart', () => {
    useNodeMetricsSuspense.mockReturnValue({
      metrics: [
        row(4, { meshtastic_channel_utilization: 10, meshtastic_air_util_tx: 1 }),
        row(5, { meshtastic_channel_utilization: 12.34, meshtastic_air_util_tx: 1.5, voltage: 3.9 }),
      ],
    });
    const { container } = render(<ChannelAirChart internalId="n1" range={rangeFor('30d')} />);
    expect(screen.getByRole('heading', { name: 'Channel and air use' })).toBeTruthy();
    expect(screen.getByTestId('chart-node-channel-air-headline').textContent).toBe('channel 12.3%');
    const headers = Array.from(container.querySelectorAll('[data-testid="trend-chart-table"] thead th')).map(
      (th) => th.textContent
    );
    expect(headers).toEqual(['Bucket', 'Channel use (%)', 'Air time TX (%)']);
    const dashed = Array.from(container.querySelectorAll('.recharts-line-curve')).filter(
      (c) => c.getAttribute('stroke-dasharray') === '5 3'
    );
    expect(dashed.length).toBeGreaterThan(0);
  });

  it('says so when there are no readings', () => {
    useNodeMetricsSuspense.mockReturnValue({ metrics: [] });
    render(<ChannelAirChart internalId="n1" range={rangeFor('7d')} />);
    expect(screen.getByTestId('chart-node-channel-air-empty').textContent).toMatch(/No channel or air-time/);
  });
});

describe('no hard-coded colours', () => {
  it('uses chart tokens in the metric chart sources', () => {
    const files = import.meta.glob(
      [
        '/src/components/BatteryChartShadcn.tsx',
        '/src/components/nodes/{ChannelAir,EnvironmentMetrics,PowerMetrics}Chart.tsx',
        '/src/components/nodes/MetricTrendCard.tsx',
      ],
      { query: '?raw', import: 'default', eager: true }
    ) as Record<string, string>;
    expect(Object.keys(files)).toHaveLength(5);
    for (const [name, source] of Object.entries(files)) {
      expect(source, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    }
  });
});
