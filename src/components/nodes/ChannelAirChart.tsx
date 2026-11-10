'use client';

import * as React from 'react';
import { MetricTrendCard } from '@/components/nodes/MetricTrendCard';
import { useNodeMetricsSuspense } from '@/hooks/api/useNodes';
import type { StatsRange } from '@/hooks/useStatsRange';
import { buildChannelAirTrend, metricQueryEnd } from '@/lib/node-metric-series';
import { metricApiBucket } from '@/lib/stats-range';

const SERIES = [
  { key: 'channel', label: 'Channel use (%)', color: 'hsl(var(--chart-1))' },
  { key: 'air', label: 'Air time TX (%)', color: 'hsl(var(--chart-2))', dashed: true },
];

const pct = (v: number) => `${Number(v.toFixed(1))}`;

/** Channel utilisation and air-time TX over the page's range: two percent series on one axis. */
export function ChannelAirChart({ internalId, range }: { internalId: string; range: StatsRange }) {
  const { window } = range;
  const params = React.useMemo(
    () => ({ startDate: window.start, endDate: metricQueryEnd(window), bucket: metricApiBucket(range.bucket) }),
    [window, range.bucket]
  );
  const { metrics } = useNodeMetricsSuspense(internalId, params);
  const trend = React.useMemo(
    () => buildChannelAirTrend(metrics, window, range.bucket),
    [metrics, window, range.bucket]
  );
  return (
    <MetricTrendCard
      title="Channel and air use"
      headline={trend.latestChannel != null ? `channel ${pct(trend.latestChannel)}%` : undefined}
      measure={`Percent · ${range.bucketLabel} mean of reports`}
      range={range}
      rows={trend.rows}
      series={SERIES}
      yRange="zero"
      formatValue={pct}
      empty={trend.hasData ? undefined : `No channel or air-time readings in the ${range.longLabel}.`}
      data-testid="chart-node-channel-air"
    />
  );
}
