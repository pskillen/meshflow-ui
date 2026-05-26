'use client';

import * as React from 'react';
import { CartesianGrid, XAxis, YAxis, Bar, Line, ComposedChart, Legend } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { useStatsSnapshotsForTypesSuspense } from '@/hooks/api/useStatsSnapshots';
import { subDays } from 'date-fns';
import { Payload, ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  aggregateStats,
  getAggregationWindow,
  globalSnapshotRows,
  mergeMeshtasticMeshcoreSeries,
  snapshotsToCountSeries,
} from '@/lib/stats-aggregation';
import {
  type MeshStatsProtocolScope,
  type OnlineNodesChartMetric,
  onlineNodesMetricStatTypes,
} from '@/lib/stats-snapshot-types';

export type { OnlineNodesChartMetric };

interface OnlineNodesChartProps {
  title: string;
  description?: string;
  config: ChartConfig;
  metric: OnlineNodesChartMetric;
  protocolScope?: MeshStatsProtocolScope;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
  embedded?: boolean;
  dateRange?: { startDate: Date; endDate: Date };
  movingAverage?: boolean;
}

export function OnlineNodesChart({
  title,
  description,
  config,
  metric,
  protocolScope = 'meshtastic',
  timeRangeOptions = [
    { key: '48h', label: 'Last 48 hours' },
    { key: '1d', label: 'Today' },
    { key: '2d', label: 'Last 2 days' },
    { key: '7d', label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
  ],
  defaultTimeRange = '2d',
  embedded = false,
  dateRange: controlledDateRange,
  movingAverage = true,
}: OnlineNodesChartProps) {
  const [timeRangeLabel, setTimeRangeLabel] = React.useState(defaultTimeRange);
  const [internalDateRange, setInternalDateRange] = React.useState<{ startDate: Date; endDate: Date }>({
    startDate: subDays(new Date(), 2),
    endDate: new Date(),
  });

  const dateRange = embedded && controlledDateRange ? controlledDateRange : internalDateRange;

  const params = React.useMemo(
    () => ({
      constellationId: -1,
      recordedAtAfter: dateRange.startDate,
      recordedAtBefore: dateRange.endDate,
      page_size: 1000,
    }),
    [dateRange.startDate, dateRange.endDate]
  );

  const statTypes = React.useMemo(() => onlineNodesMetricStatTypes(metric, protocolScope), [metric, protocolScope]);
  const snapshotResults = useStatsSnapshotsForTypesSuspense(statTypes, params);

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeLabel) return;
    setTimeRangeLabel(value);
    setInternalDateRange(timeRange);
  };

  const aggregationWindow = React.useMemo(
    () => (metric === 'new_nodes' ? 'daily' : getAggregationWindow(dateRange.startDate, dateRange.endDate)),
    [dateRange.startDate, dateRange.endDate, metric]
  );

  const overlayMode = protocolScope === 'both';
  const mcStatType = metric === 'online_nodes' ? 'mc_online_nodes' : 'mc_new_nodes';

  const chartData = React.useMemo(() => {
    const mergeMethod = metric === 'online_nodes' ? 'average' : 'sum';

    if (overlayMode) {
      const mtRaw = snapshotsToCountSeries(globalSnapshotRows(snapshotResults[metric]));
      const mcRaw = snapshotsToCountSeries(globalSnapshotRows(snapshotResults[mcStatType]));
      const mtAgg = aggregateStats(mtRaw, aggregationWindow, mergeMethod);
      const mcAgg = aggregateStats(mcRaw, aggregationWindow, mergeMethod);
      const merged = mergeMeshtasticMeshcoreSeries(mtAgg, mcAgg);
      if (metric === 'new_nodes') {
        return merged.map((p) => ({
          ...p,
          meshtastic: Math.round(p.meshtastic),
          meshcore: Math.round(p.meshcore),
        }));
      }
      return merged;
    }

    const statKey = protocolScope === 'meshcore' ? mcStatType : metric;
    const rows = globalSnapshotRows(snapshotResults[statKey]);
    const raw = snapshotsToCountSeries(rows);
    const aggregated = aggregateStats(raw, aggregationWindow, mergeMethod);
    const rounded = metric === 'new_nodes' ? aggregated.map((p) => ({ ...p, value: Math.round(p.value) })) : aggregated;

    const windowSize = aggregationWindow === 'hourly' ? Math.min(24, rounded.length) : Math.min(4, rounded.length);
    return rounded.map((stat, index) => {
      const startIdx = Math.max(0, index - windowSize + 1);
      const window = rounded.slice(startIdx, index + 1);
      const avg = window.length > 0 ? window.reduce((acc, i) => acc + i.value, 0) / window.length : 0;
      return { ...stat, movingAverage: avg };
    });
  }, [snapshotResults, aggregationWindow, metric, overlayMode, protocolScope, mcStatType]);

  const yAxisDomain = React.useMemo(() => {
    if (!chartData.length) return [0, 'auto'] as [number, 'auto'];
    const values = overlayMode
      ? (chartData as { meshtastic: number; meshcore: number }[]).flatMap((item) => [item.meshtastic, item.meshcore])
      : (chartData as { value: number; movingAverage?: number }[]).flatMap((item) => [
          item.value,
          item.movingAverage ?? 0,
        ]);
    const maxVal = Math.max(...values, 0);
    if (metric === 'new_nodes') {
      const top = maxVal <= 0 ? 1 : Math.max(Math.ceil(maxVal * 1.15), maxVal + 1);
      return [0, top] as [number, number];
    }
    const maxOnline = Math.max(...values, 1);
    return [0, maxOnline] as [number, number];
  }, [chartData, metric, overlayMode]);

  const tickFormatter = (value: number) => {
    const date = new Date(value);
    if (aggregationWindow === 'daily') {
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    }
    if (aggregationWindow === '6h') {
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: 'numeric' });
    }
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  };

  const tooltipLabelFormatter = (_: unknown, payload: readonly Payload<ValueType, NameType>[]) => {
    if (payload?.[0]?.payload?.timestamp != null) {
      return tickFormatter(payload[0].payload.timestamp);
    }
    return 'Unknown time';
  };

  const chartContent = (
    <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
      <ComposedChart data={chartData as Record<string, number>[]}>
        {!overlayMode && (
          <defs>
            <linearGradient id={`fillOnlineNodes-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-value)" stopOpacity={1.0} />
              <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        )}
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={80}
          tickCount={6}
          scale="time"
          type="number"
          domain={[dateRange.startDate.getTime(), dateRange.endDate.getTime()]}
          tickFormatter={tickFormatter}
        />
        <YAxis
          domain={yAxisDomain}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
          tickFormatter={metric === 'new_nodes' ? (v: number) => Math.round(v).toString() : undefined}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={tooltipLabelFormatter} indicator="dot" />}
        />
        {overlayMode ? (
          <>
            <Legend />
            <Bar dataKey="meshtastic" fill="var(--color-meshtastic)" fillOpacity={0.75} barSize={8} name="Meshtastic" />
            <Bar dataKey="meshcore" fill="var(--color-meshcore)" fillOpacity={0.75} barSize={8} name="MeshCore" />
          </>
        ) : (
          <>
            <Bar dataKey="value" fill="var(--color-value)" fillOpacity={0.7} barSize={8} />
            {movingAverage && (
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                name={aggregationWindow === 'hourly' ? '24h Moving Average' : 'Moving Average'}
              />
            )}
          </>
        )}
      </ComposedChart>
    </ChartContainer>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-1">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mb-2">{description}</p>}
        {chartContent}
      </div>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>{title}</CardTitle>
        {description && (
          <CardDescription>
            <span className="@[540px]/card:block hidden">{description}</span>
            <span className="@[540px]/card:hidden">
              {timeRangeOptions.find((option) => option.key === timeRangeLabel)?.label}
            </span>
          </CardDescription>
        )}
        <div className="absolute right-4 top-4">
          <TimeRangeSelect options={timeRangeOptions} value={timeRangeLabel} onChange={handleTimeRangeChange} />
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">{chartContent}</CardContent>
    </Card>
  );
}
