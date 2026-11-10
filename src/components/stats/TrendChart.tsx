import { useContext, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Rectangle, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ChartCardContext } from '@/components/stats/chart-card-context';
import { maxStackTotal, niceAxisMax } from '@/lib/axis-ticks';
import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';
import {
  PARTIAL_LINE_SUFFIX,
  densifyTrendRows,
  describeTrend,
  evenTrendTicks,
  formatCompact,
  formatTrendLabel,
  formatTrendTick,
  splitPartialLine,
  type TrendRow,
} from '@/lib/stats-trend';

export interface TrendSeries {
  /** Field name in each row. */
  key: string;
  /** Legend and tooltip name. */
  label: string;
  /** CSS colour, normally a chart token: `hsl(var(--chart-1))`. */
  color: string;
}

export interface TrendChartProps {
  /** `line` for point-in-time counts (Online nodes), `bar` for per-bucket totals (New nodes, Packet volume). */
  kind: 'line' | 'bar';
  /** One row per bucket start (`timestamp`, ms), one number per series key, optional `partial`. Gaps are fine. */
  rows: TrendRow[];
  series: TrendSeries[];
  /** The range window; its bounds fix the x-axis, so charts with the same window share x positions. */
  window: Pick<StatsRangeWindow, 'start' | 'end'>;
  bucket: StatsBucket;
  /** Bars only: stack the series (default) or draw them side by side. */
  stacked?: boolean;
  /** Charts with the same id share their hover cursor. */
  syncId?: string;
  /** Pixel height. Default 190. */
  height?: number;
  /**
   * Accessible name stem: the chart's title and range, "Online nodes, last 7 days". The chart's full name adds the
   * bucket size, `headline`, the latest value and whether the last bucket is in progress; a table of every bucketed
   * value follows the chart for screen readers.
   */
  label?: string;
  /** The card's headline ("avg 88"), repeated in the accessible name. */
  headline?: string;
  className?: string;
}

/** Marker on a bucket that is in progress or only partly covered. */
export const PARTIAL_MARK = 'partial bucket';

type PartialRectProps = React.ComponentProps<typeof Rectangle> & { payload?: { partial?: boolean } };

function PartialAwareBar(props: PartialRectProps) {
  const { payload, ...rect } = props;
  return payload?.partial ? (
    <Rectangle
      {...rect}
      fillOpacity={0.4}
      stroke={typeof rect.fill === 'string' ? rect.fill : undefined}
      strokeDasharray="3 2"
      strokeWidth={1}
    />
  ) : (
    <Rectangle {...rect} />
  );
}

/**
 * Line or bar chart over one range window. Lays rows on the full bucket grid, fits the y-axis with `niceAxisMax`,
 * marks partial buckets (dashed line, faded dashed bars, "partial bucket" in the tooltip) and shares hover through
 * `syncId`. See TrendChart.md.
 */
export function TrendChart({
  kind,
  rows,
  series,
  window: range,
  bucket,
  stacked = true,
  syncId,
  height = 190,
  label,
  headline,
  className,
}: TrendChartProps) {
  const { headlineId } = useContext(ChartCardContext);
  const keys = useMemo(() => series.map((s) => s.key), [series]);
  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])),
    [series]
  );
  // start/end are Dates: key on their times so a fresh-but-equal window does not recompute.
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const dense = useMemo(
    () => densifyTrendRows(rows, { start: new Date(startMs), end: new Date(endMs) }, bucket),
    [rows, startMs, endMs, bucket]
  );
  const lineRows = useMemo(() => (kind === 'line' ? splitPartialLine(dense, keys) : []), [kind, dense, keys]);

  const axis = useMemo(() => {
    const numeric = dense.map((r) =>
      Object.fromEntries(keys.map((k) => [k, typeof r[k] === 'number' ? (r[k] as number) : 0]))
    ) as Record<string, number>[];
    const max =
      kind === 'bar' && stacked
        ? maxStackTotal(numeric)
        : Math.max(0, ...numeric.flatMap((r) => keys.map((k) => r[k] ?? 0)));
    return niceAxisMax(max);
  }, [dense, keys, kind, stacked]);

  const ticks = useMemo(() => evenTrendTicks(dense.map((r) => r.timestamp)), [dense]);
  const description = useMemo(
    () => describeTrend({ label, headline, bucket, rows: dense, series }),
    [label, headline, bucket, dense, series]
  );

  const common = {
    syncId,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };

  const xAxis = (
    <XAxis
      dataKey="timestamp"
      tickLine={false}
      axisLine={false}
      tickMargin={6}
      ticks={ticks}
      interval={0}
      tickFormatter={(t: number) => formatTrendTick(t, bucket)}
    />
  );
  const yAxis = (
    <YAxis
      width={44}
      tickLine={false}
      axisLine={false}
      domain={[0, axis.max]}
      ticks={axis.ticks}
      allowDecimals={false}
      tickFormatter={formatCompact}
    />
  );
  const tooltip = (
    <ChartTooltip
      cursor={kind === 'bar' ? false : undefined}
      content={
        <ChartTooltipContent
          indicator="dot"
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { timestamp?: number; partial?: boolean } | undefined;
            if (row?.timestamp == null) return 'Unknown time';
            return `${formatTrendLabel(row.timestamp, bucket)}${row.partial ? ` · ${PARTIAL_MARK}` : ''}`;
          }}
        />
      }
    />
  );
  const legend = series.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null;

  return (
    <>
      <ChartContainer
        config={config}
        className={className ?? 'aspect-auto w-full'}
        style={{ height }}
        role="img"
        aria-label={description.name}
        aria-describedby={headlineId}
        data-testid="trend-chart"
        data-kind={kind}
      >
        {kind === 'line' ? (
          <LineChart data={lineRows} {...common}>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            {series.map((s) => (
              <Line
                key={`${s.key}${PARTIAL_LINE_SUFFIX}`}
                dataKey={`${s.key}${PARTIAL_LINE_SUFFIX}`}
                name={s.label}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                legendType="none"
                tooltipType="none"
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={dense} maxBarSize={56} {...common}>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'stack' : undefined}
                fill={`var(--color-${s.key})`}
                radius={!stacked || i === series.length - 1 ? [3, 3, 0, 0] : 0}
                shape={(p: unknown) => <PartialAwareBar {...(p as PartialRectProps)} />}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ChartContainer>
      <table className="sr-only" data-testid="trend-chart-table">
        <caption>{description.name}</caption>
        <thead>
          <tr>
            <th scope="col">Bucket</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {description.table.map((row) => (
            <tr key={row.timestamp}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, i) => (
                <td key={series[i]!.key}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
