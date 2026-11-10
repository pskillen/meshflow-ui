import type { ReactNode } from 'react';
import { ChartCard } from '@/components/stats/ChartCard';
import { TrendChart, type TrendChartProps } from '@/components/stats/TrendChart';
import type { StatsRange } from '@/hooks/useStatsRange';
import { formatTrendLabel } from '@/lib/stats-trend';

export const NODE_METRICS_SYNC_ID = 'node-metrics';

export interface MetricTrendCardProps {
  title: string;
  /** The latest value, as a short string ("3.87 V", "Powered"). */
  headline?: string;
  /** What one point is: the unit and the bucket. */
  measure: string;
  range: StatsRange;
  rows: TrendChartProps['rows'];
  series: TrendChartProps['series'];
  yRange?: TrendChartProps['yRange'];
  formatValue?: TrendChartProps['formatValue'];
  legend?: boolean;
  /** Extra small print before the standard partial-bucket note. */
  note?: ReactNode;
  /** Controls for this chart only (the battery's Voltage / Percentage toggle). */
  actions?: ReactNode;
  /** Replaces the chart when there is nothing to plot. */
  empty?: ReactNode;
  'data-testid'?: string;
}

/**
 * A node metric as a `ChartCard` around a line `TrendChart` on the page's shared range window, with the common
 * sync id (shared hover), partial-bucket note and empty state. See MetricTrendCard.md.
 */
export function MetricTrendCard({
  title,
  headline,
  measure,
  range,
  rows,
  series,
  yRange,
  formatValue,
  legend,
  note,
  actions,
  empty,
  'data-testid': testId,
}: MetricTrendCardProps) {
  const hasPartial = rows.some((r) => r.partial);
  const latest = [...rows].reverse().find((r) => series.some((s) => typeof r[s.key] === 'number'));
  const notes = [
    note,
    hasPartial ? 'Dashed: the bucket in progress.' : null,
    latest && range.bucket !== 'daily' ? `Latest point ${formatTrendLabel(latest.timestamp, range.bucket)}.` : null,
  ].filter((n) => n != null && n !== '');
  return (
    <ChartCard
      title={title}
      headline={empty ? undefined : headline}
      measure={measure}
      actions={actions}
      note={
        notes.length ? (
          <>
            {notes.map((n, i) => (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                {n}
              </span>
            ))}
          </>
        ) : undefined
      }
      data-testid={testId}
    >
      {empty ? (
        <div
          className="flex items-center justify-center rounded-md bg-muted/40 px-3 text-center text-sm text-muted-foreground"
          style={{ height: 190 }}
          data-testid={testId ? `${testId}-empty` : undefined}
        >
          {empty}
        </div>
      ) : (
        <TrendChart
          kind="line"
          rows={rows}
          series={series}
          window={range.window}
          bucket={range.bucket}
          syncId={NODE_METRICS_SYNC_ID}
          yRange={yRange}
          formatValue={formatValue}
          legend={legend}
          label={`${title}, ${range.longLabel}`}
          headline={headline}
        />
      )}
    </ChartCard>
  );
}
