'use client';

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Cell, Legend, Pie, PieChart } from 'recharts';
import { useNeighbourStats } from '@/hooks/api/usePacketStats';
import { subDays } from 'date-fns';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { NeighbourStatsBySource } from '@/lib/models';

export interface DateRangeProp {
  startDate: Date;
  endDate: Date;
}

interface NeighbourPieChartProps {
  nodeId: number;
  defaultTimeRange?: string;
  config?: ChartConfig;
  /** When provided, use this date range instead of internal state (controlled mode). Hides the time range selector. */
  controlledDateRange?: DateRangeProp;
}

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#6b7280', // gray-500
];

const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: '1h', label: 'Last hour' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
];

const LSB_EXPLANATION =
  "For multi-hop packets, the radio header only stores the last byte (LSB) of the relay node's ID to save bandwidth. Several nodes can share the same last byte, so we list all possible matches from nodes we've seen on the mesh.";

const getInitialDateRange = () => {
  const endDate = new Date();
  const startDate = subDays(endDate, 1);
  return { startDate, endDate };
};

function getLabel(item: NeighbourStatsBySource): string {
  if (item.source_type === 'full' && item.candidates.length > 0) {
    const c = item.candidates[0];
    return c.short_name || c.node_id_str;
  }
  if (item.source_type === 'lsb' && item.candidates.length === 1) {
    const c = item.candidates[0];
    return c.short_name || c.node_id_str;
  }
  if (item.source_type === 'lsb') {
    return `LSB ${item.source}`;
  }
  return item.candidates[0]?.node_id_str ?? `Source ${item.source}`;
}

export function NeighbourPieChart({
  nodeId,
  defaultTimeRange = '24h',
  config = {
    value: {
      theme: {
        light: 'var(--color-value)',
        dark: 'var(--color-value)',
      },
    },
  },
  controlledDateRange,
}: NeighbourPieChartProps) {
  const [timeRange, setTimeRange] = React.useState(defaultTimeRange);
  const [internalDateRange, setInternalDateRange] = React.useState(getInitialDateRange);

  const dateRange = controlledDateRange ?? internalDateRange;
  const isControlled = controlledDateRange != null;

  const {
    data: stats,
    isLoading,
    error,
  } = useNeighbourStats({
    nodeId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    enabled: true,
  });

  const chartData = React.useMemo(() => {
    if (!stats?.by_source?.length) return [];
    return stats.by_source.map((item, index) => ({
      ...item,
      name: getLabel(item),
      value: item.count,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [stats]);

  const handleTimeRangeChange = React.useCallback(
    (value: string, newDateRange: { startDate: Date; endDate: Date }) => {
      setTimeRange(value);
      if (!controlledDateRange) setInternalDateRange(newDateRange);
    },
    [controlledDateRange]
  );

  const maxCount = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Packets by source</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center bg-muted rounded-md">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Packets by source</CardTitle>
          <CardDescription>Failed to load</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Packets by source</CardTitle>
        <CardDescription>Packets received from each neighbour (direct or last hop)</CardDescription>
        {!isControlled && (
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <TimeRangeSelect options={TIME_RANGE_OPTIONS} value={timeRange} onChange={handleTimeRangeChange} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 space-y-4">
        {chartData.length > 0 ? (
          <>
            <ChartContainer className="aspect-auto h-[250px] w-full" config={config}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [`${value} packets`, '']}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload as (typeof chartData)[0] | undefined;
                        return item?.candidates?.length ? `${label} (${item.candidates.length} candidate(s))` : label;
                      }}
                    />
                  }
                />
                <Legend />
              </PieChart>
            </ChartContainer>

            <div className="rounded-md border border-border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-3">{LSB_EXPLANATION}</p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">By source</div>
              <div className="space-y-2">
                {chartData.map((item, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium shrink-0">{getLabel(item)}</span>
                      <span className="text-sm text-muted-foreground">{item.count} packets</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden" style={{ width: '100%' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%`,
                          backgroundColor: item.fill,
                        }}
                      />
                    </div>
                    {item.candidates.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.candidates.map((c) => (
                          <Link
                            key={c.node_id}
                            to={`/nodes/${c.node_id}`}
                            className="text-xs text-teal-600 dark:text-teal-400 hover:underline px-1.5 py-0.5 rounded bg-muted"
                          >
                            {c.short_name || c.node_id_str}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-[250px] items-center justify-center rounded-md bg-muted">
            <p className="text-muted-foreground">No packet data in this time range</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
