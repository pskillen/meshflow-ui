'use client';

import * as React from 'react';
import { CartesianGrid, XAxis, YAxis, Bar, BarChart, Line, ComposedChart, Legend } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { useStatsSnapshotsForTypesSuspense } from '@/hooks/api/useStatsSnapshots';
import { subDays } from 'date-fns';
import { Payload, ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import {
  getAggregationWindow,
  aggregateStats,
  aggregateStatsByType,
  PACKET_TYPE_DISPLAY_NAMES,
  globalSnapshotRows,
  mergeMeshtasticMeshcoreSeries,
  snapshotsToCountSeries,
} from '@/lib/stats-aggregation';
import {
  MC_PACKET_TYPE_DISPLAY_NAMES,
  packetVolumeStatTypes,
  type MeshStatsProtocolScope,
} from '@/lib/stats-snapshot-types';

interface PacketStatsChartFromSnapshotsProps {
  title: string;
  description?: string;
  config: ChartConfig;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
  /** When true, render without Card/TimeRangeSelect; use dateRange from parent */
  embedded?: boolean;
  dateRange?: { startDate: Date; endDate: Date };
  protocolScope?: MeshStatsProtocolScope;
}

/**
 * Packet stats chart that uses collected stats snapshots (packet_volume) instead of
 * the on-demand stats/global endpoint. Use for global dashboard views.
 */
export function PacketStatsChartFromSnapshots({
  title,
  description,
  config,
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
  protocolScope = 'meshtastic',
}: PacketStatsChartFromSnapshotsProps) {
  const [timeRangeLabel, setTimeRangeLabel] = React.useState(defaultTimeRange);
  const [viewMode, setViewMode] = React.useState<'total' | 'byType'>('total');
  const [internalDateRange, setInternalDateRange] = React.useState<{ startDate: Date; endDate: Date }>({
    startDate: subDays(new Date(), 2),
    endDate: new Date(),
  });

  const dateRange = embedded && controlledDateRange ? controlledDateRange : internalDateRange;

  const snapshotParams = React.useMemo(
    () => ({
      constellationId: -1,
      recordedAtAfter: dateRange.startDate,
      recordedAtBefore: dateRange.endDate,
      page_size: 1000,
    }),
    [dateRange.startDate, dateRange.endDate]
  );

  const statTypes = React.useMemo(() => packetVolumeStatTypes(protocolScope), [protocolScope]);
  const snapshotResults = useStatsSnapshotsForTypesSuspense(statTypes, snapshotParams);
  const overlayMode = protocolScope === 'both';
  const packetTypeLabels = protocolScope === 'meshcore' ? MC_PACKET_TYPE_DISPLAY_NAMES : PACKET_TYPE_DISPLAY_NAMES;

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeLabel) return;
    setTimeRangeLabel(value);
    setInternalDateRange(timeRange);
  };

  const aggregationWindow = React.useMemo(
    () => getAggregationWindow(dateRange.startDate, dateRange.endDate),
    [dateRange.startDate, dateRange.endDate]
  );

  const chartDataTotal = React.useMemo(() => {
    if (overlayMode) {
      const mtRaw = snapshotsToCountSeries(globalSnapshotRows(snapshotResults.packet_volume));
      const mcRaw = snapshotsToCountSeries(globalSnapshotRows(snapshotResults.mc_packet_volume));
      const mtAgg = aggregateStats(mtRaw, aggregationWindow, 'sum');
      const mcAgg = aggregateStats(mcRaw, aggregationWindow, 'sum');
      return mergeMeshtasticMeshcoreSeries(mtAgg, mcAgg);
    }

    const statKey = protocolScope === 'meshcore' ? 'mc_packet_volume' : 'packet_volume';
    const sorted = globalSnapshotRows(snapshotResults[statKey]);
    let stats = snapshotsToCountSeries(sorted);
    stats = aggregateStats(stats, aggregationWindow, 'sum');

    const windowSize = aggregationWindow === 'hourly' ? Math.min(24, stats.length) : Math.min(4, stats.length);
    return stats.map((stat, index) => {
      const startIdx = Math.max(0, index - windowSize + 1);
      const window = stats.slice(startIdx, index + 1);
      const avg = window.length > 0 ? window.reduce((acc, i) => acc + i.value, 0) / window.length : 0;
      return { ...stat, movingAverage: avg };
    });
  }, [snapshotResults, aggregationWindow, overlayMode, protocolScope]);

  const chartDataByType = React.useMemo(() => {
    if (overlayMode) return [];

    const statKey = protocolScope === 'meshcore' ? 'mc_packet_volume' : 'packet_volume';
    const sorted = globalSnapshotRows(snapshotResults[statKey]);
    const raw = sorted
      .filter((s) => s.value?.by_type)
      .map((s) => ({
        timestamp: new Date(s.recorded_at).getTime(),
        byType: s.value!.by_type!,
      }));
    return aggregateStatsByType(raw, aggregationWindow);
  }, [snapshotResults, aggregationWindow, overlayMode, protocolScope]);

  const chartData =
    viewMode === 'total'
      ? chartDataTotal
      : (chartDataByType.map((d) => ({ timestamp: d.timestamp, ...d.byType })) as Record<string, number>[]);

  const yAxisDomain = React.useMemo(() => {
    if (!chartData.length) return [0, 'auto'] as [number, 'auto'];
    const values =
      viewMode === 'total'
        ? overlayMode
          ? (chartData as { meshtastic: number; meshcore: number }[]).flatMap((item) => [
              item.meshtastic,
              item.meshcore,
            ])
          : (chartData as { value: number }[]).map((item) => item.value)
        : (chartData as Record<string, number>[]).flatMap((item) =>
            Object.entries(item)
              .filter(([k]) => k !== 'timestamp')
              .map(([, v]) => v)
          );
    if (values.length === 0) return [0, 'auto'] as [number, 'auto'];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const maxValue = Math.max(mean + 5 * stdDev, Math.max(...values));
    return [0, maxValue] as [number, number];
  }, [chartData, viewMode, overlayMode]);

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

  const packetTypeKeys = Object.keys(packetTypeLabels);
  const showByTypeToggle = !overlayMode;

  const chartContent = (
    <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
      {viewMode === 'total' ? (
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="fillPacketValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-value)" stopOpacity={1.0} />
              <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
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
          <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent labelFormatter={tooltipLabelFormatter} indicator="dot" />}
          />
          {overlayMode ? (
            <>
              <Legend />
              <Bar
                dataKey="meshtastic"
                fill="var(--color-meshtastic)"
                fillOpacity={0.75}
                barSize={8}
                name="Meshtastic"
              />
              <Bar dataKey="meshcore" fill="var(--color-meshcore)" fillOpacity={0.75} barSize={8} name="MeshCore" />
            </>
          ) : (
            <>
              <Bar dataKey="value" fill="var(--color-value)" fillOpacity={0.7} barSize={8} />
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                name={aggregationWindow === 'hourly' ? '24h Moving Average' : 'Moving Average'}
              />
            </>
          )}
        </ComposedChart>
      ) : (
        <BarChart data={chartData}>
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
          <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent labelFormatter={tooltipLabelFormatter} indicator="dot" />}
          />
          {packetTypeKeys.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="stack"
              fill={`var(--color-${key})`}
              fillOpacity={0.8}
              name={packetTypeLabels[key]}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );

  if (embedded) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {showByTypeToggle && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as 'total' | 'byType')}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="total" aria-label="Total packets">
                Total
              </ToggleGroupItem>
              <ToggleGroupItem value="byType" aria-label="Packets by type">
                By type
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
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
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {showByTypeToggle && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(v) => v && setViewMode(v as 'total' | 'byType')}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="total" aria-label="Total packets">
                Total
              </ToggleGroupItem>
              <ToggleGroupItem value="byType" aria-label="Packets by type">
                By type
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <TimeRangeSelect options={timeRangeOptions} value={timeRangeLabel} onChange={handleTimeRangeChange} />
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">{chartContent}</CardContent>
    </Card>
  );
}
