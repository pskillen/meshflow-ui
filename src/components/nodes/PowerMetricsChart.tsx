'use client';

import * as React from 'react';
import { MetricTrendCard } from '@/components/nodes/MetricTrendCard';
import { useNodePowerMetricsSuspense } from '@/hooks/api/useNodes';
import type { StatsRange } from '@/hooks/useStatsRange';
import { buildFieldTrend, metricQueryEnd } from '@/lib/node-metric-series';
import { metricApiBucket } from '@/lib/stats-range';
import type { TrendSeries } from '@/components/stats/TrendChart';

const CHANNELS = [1, 2, 3, 4, 5, 6, 7, 8];
const FIELDS = CHANNELS.flatMap((n) => [`ch${n}_voltage`, `ch${n}_current`]);

const plain = (v: number) => `${Number(v.toFixed(2))}`;

/** Chart tokens for the first five channels, then the same colours dashed, so channels differ without colour alone. */
function channelSeries(present: string[], kind: 'voltage' | 'current'): TrendSeries[] {
  return CHANNELS.filter((n) => present.includes(`ch${n}_${kind}`)).map((n, i) => ({
    key: `ch${n}_${kind}`,
    label: `Channel ${n}`,
    color: `hsl(var(--chart-${(i % 5) + 1}))`,
    dashed: i >= 5,
  }));
}

interface PowerMetricsChartProps {
  internalId: string;
  /** The page's shared range (`useStatsRange`). */
  range: StatsRange;
}

/**
 * Power channel voltage and current as two chart cards (volts and amps never share an axis), on the page's shared
 * window and buckets. Renders cards only, so the parent lays them out in its grid. See PowerMetricsChart.md.
 */
export function PowerMetricsChart({ internalId, range }: PowerMetricsChartProps) {
  const { window } = range;
  const params = React.useMemo(
    () => ({ startDate: window.start, endDate: metricQueryEnd(window), bucket: metricApiBucket(range.bucket) }),
    [window, range.bucket]
  );
  const { metrics } = useNodePowerMetricsSuspense(internalId, params);
  const trend = React.useMemo(
    () => buildFieldTrend(metrics, FIELDS, window, range.bucket),
    [metrics, window, range.bucket]
  );

  const voltage = channelSeries(trend.present, 'voltage');
  const current = channelSeries(trend.present, 'current');
  if (voltage.length === 0 && current.length === 0) {
    return (
      <MetricTrendCard
        title="Power channels"
        measure={`${range.bucketLabel} mean`}
        range={range}
        rows={[]}
        series={[]}
        empty={`No power readings in the ${range.longLabel}.`}
        data-testid="chart-node-power-empty"
      />
    );
  }
  const card = (kind: 'voltage' | 'current', series: TrendSeries[]) =>
    series.length > 0 && (
      <MetricTrendCard
        title={kind === 'voltage' ? 'Power channel voltage' : 'Power channel current'}
        measure={`${kind === 'voltage' ? 'Volts' : 'Amps'} · ${range.bucketLabel} mean`}
        range={range}
        rows={trend.rows}
        series={series}
        yRange="fit"
        formatValue={plain}
        data-testid={`chart-node-power-${kind}`}
      />
    );
  return (
    <>
      {card('voltage', voltage)}
      {card('current', current)}
    </>
  );
}
