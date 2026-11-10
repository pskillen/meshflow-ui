'use client';

import * as React from 'react';
import { MetricTrendCard } from '@/components/nodes/MetricTrendCard';
import { useNodeEnvironmentMetricsSuspense } from '@/hooks/api/useNodes';
import type { StatsRange } from '@/hooks/useStatsRange';
import { buildFieldTrend, metricQueryEnd } from '@/lib/node-metric-series';
import { metricApiBucket } from '@/lib/stats-range';

interface EnvironmentSeries {
  field: string;
  title: string;
  unit: string;
}

/** Order is the order of the cards. Temperature and humidity lead, as in the design. */
const ENVIRONMENT_SERIES: EnvironmentSeries[] = [
  { field: 'temperature', title: 'Temperature', unit: '°C' },
  { field: 'relative_humidity', title: 'Humidity', unit: '%' },
  { field: 'barometric_pressure', title: 'Pressure', unit: 'hPa' },
  { field: 'gas_resistance', title: 'Gas resistance', unit: 'Ω' },
  { field: 'iaq', title: 'Air quality (IAQ)', unit: '' },
  { field: 'lux', title: 'Light', unit: 'lx' },
  { field: 'wind_speed', title: 'Wind speed', unit: 'm/s' },
  { field: 'radiation', title: 'Radiation', unit: '' },
  { field: 'rainfall_1h', title: 'Rainfall, 1 hour', unit: 'mm' },
  { field: 'rainfall_24h', title: 'Rainfall, 24 hours', unit: 'mm' },
];

const plain = (v: number) => `${Number(v.toFixed(2))}`;

interface EnvironmentMetricsChartProps {
  internalId: string;
  /** The page's shared range (`useStatsRange`). */
  range: StatsRange;
}

/**
 * One chart card per environment reading the node has in the range (temperature, humidity, ...), on the page's shared
 * window and buckets. Renders cards only, so the parent lays them out in its grid. See EnvironmentMetricsChart.md.
 */
export function EnvironmentMetricsChart({ internalId, range }: EnvironmentMetricsChartProps) {
  const { window } = range;
  const params = React.useMemo(
    () => ({ startDate: window.start, endDate: metricQueryEnd(window), bucket: metricApiBucket(range.bucket) }),
    [window, range.bucket]
  );
  const { metrics } = useNodeEnvironmentMetricsSuspense(internalId, params);
  const fields = React.useMemo(() => ENVIRONMENT_SERIES.map((s) => s.field), []);
  const trend = React.useMemo(
    () => buildFieldTrend(metrics, fields, window, range.bucket),
    [metrics, fields, window, range.bucket]
  );

  const shown = ENVIRONMENT_SERIES.filter((s) => trend.present.includes(s.field));
  if (shown.length === 0) {
    return (
      <MetricTrendCard
        title="Environment"
        measure={`${range.bucketLabel} mean`}
        range={range}
        rows={[]}
        series={[]}
        empty={`No environment readings in the ${range.longLabel}.`}
        data-testid="chart-node-environment-empty"
      />
    );
  }
  return (
    <>
      {shown.map((s) => (
        <MetricTrendCard
          key={s.field}
          title={s.title}
          headline={`${plain(trend.latest[s.field]!)}${s.unit ? ` ${s.unit}` : ''}`}
          measure={`${s.unit || 'Value'} · ${range.bucketLabel} mean`}
          range={range}
          rows={trend.rows}
          series={[{ key: s.field, label: `${s.title}${s.unit ? ` (${s.unit})` : ''}`, color: 'hsl(var(--chart-1))' }]}
          yRange="fit"
          formatValue={plain}
          data-testid={`chart-node-env-${s.field}`}
        />
      ))}
    </>
  );
}
