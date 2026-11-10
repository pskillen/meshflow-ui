'use client';

import * as React from 'react';
import { MetricTrendCard } from '@/components/nodes/MetricTrendCard';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useNodeMetricsSuspense } from '@/hooks/api/useNodes';
import type { StatsRange } from '@/hooks/useStatsRange';
import { buildBatteryTrend, metricQueryEnd, type BatteryMode } from '@/lib/node-metric-series';
import { metricApiBucket } from '@/lib/stats-range';

export type BatteryDisplayMode = BatteryMode;

interface BatteryChartShadcnProps {
  internalId: string;
  /** The page's shared range (`useStatsRange`). */
  range: StatsRange;
  /** Which reading to start on. Default volts. */
  defaultMode?: BatteryMode;
}

const volts = (v: number) => `${Number(v.toFixed(2))}`;
const percent = (v: number) => `${Math.round(v)}`;

/**
 * Battery over the page's range: volts or percent, one at a time, on its own axis (never mixed with channel use).
 * A raw level of 101 is "Powered" and is not plotted. See BatteryChartShadcn.md.
 */
export function BatteryChartShadcn({ internalId, range, defaultMode = 'voltage' }: BatteryChartShadcnProps) {
  const [mode, setMode] = React.useState<BatteryMode>(defaultMode);
  const { window } = range;
  const params = React.useMemo(
    () => ({ startDate: window.start, endDate: metricQueryEnd(window), bucket: metricApiBucket(range.bucket) }),
    [window, range.bucket]
  );
  const { metrics } = useNodeMetricsSuspense(internalId, params);
  const trend = React.useMemo(
    () => buildBatteryTrend(metrics, mode, window, range.bucket),
    [metrics, mode, window, range.bucket]
  );

  const volt = mode === 'voltage';
  let headline: string | undefined;
  if (volt) headline = trend.latestVoltage != null ? `${volts(trend.latestVoltage)} V` : undefined;
  else if (trend.latest.kind === 'powered') headline = 'Powered';
  else if (trend.latest.kind === 'level') headline = `${trend.latest.pct}%`;

  let empty: React.ReactNode;
  if (!trend.hasData) {
    empty =
      !volt && trend.poweredBuckets > 0
        ? 'Powered: this node reports an external supply, so there is no battery level to plot.'
        : `No battery ${volt ? 'voltage' : 'level'} reported in the ${range.longLabel}.`;
  }

  // "Powered" must show in both modes when the newest bucket is powered; the count is only for plotted percent charts.
  const buckets = `${trend.poweredBuckets} ${trend.poweredBuckets === 1 ? 'bucket' : 'buckets'}`;
  const notPlotted = !volt && trend.hasData && trend.poweredBuckets > 0;
  let note: string | undefined;
  if (notPlotted) note = `Powered (external supply) in ${buckets}, not plotted.`;
  else if (trend.latest.kind === 'powered') note = 'Powered (external supply).';

  return (
    <MetricTrendCard
      title="Battery"
      headline={headline}
      measure={`${volt ? 'Volts' : 'Percent'} · ${range.bucketLabel} mean of reports`}
      range={range}
      rows={trend.rows}
      series={[{ key: 'value', label: volt ? 'Voltage (V)' : 'Battery (%)', color: 'hsl(var(--chart-1))' }]}
      yRange={volt ? 'fit' : [0, 100]}
      formatValue={volt ? volts : percent}
      note={note}
      keepHeadline={!volt && trend.latest.kind === 'powered'}
      actions={
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as BatteryMode)}
          variant="outline"
          size="sm"
          aria-label="Battery reading"
        >
          <ToggleGroupItem value="voltage" aria-label="Show voltage (V)" className="h-7 px-2 text-xs">
            Voltage
          </ToggleGroupItem>
          <ToggleGroupItem value="percentage" aria-label="Show percentage (%)" className="h-7 px-2 text-xs">
            Percentage
          </ToggleGroupItem>
        </ToggleGroup>
      }
      empty={empty}
      data-testid="chart-node-battery"
    />
  );
}
