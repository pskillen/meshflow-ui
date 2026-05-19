'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useNodePowerMetricsSuspense } from '@/hooks/api/useNodes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';

const CHANNEL_COLORS = ['#ff7b72', '#79c0ff', '#7ee787', '#ffa657', '#d0a8ff', '#ffcc66', '#a371f7', '#58a6ff'];

export interface DateRangeProp {
  startDate: Date;
  endDate: Date;
}

interface PowerMetricsChartProps {
  internalId: string;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
  /** When provided, use this date range instead of internal state (controlled mode). Hides the time range selector. */
  controlledDateRange?: DateRangeProp;
}

export function PowerMetricsChart({
  internalId,
  timeRangeOptions = [
    { key: '24h', label: '24 hours' },
    { key: '48h', label: '48 hours' },
    { key: '7d', label: '7 days' },
    { key: '14d', label: '14 days' },
  ],
  defaultTimeRange = '48h',
  controlledDateRange,
}: PowerMetricsChartProps) {
  const [timeRangeLabel, setTimeRangeLabel] = React.useState(defaultTimeRange);
  const [internalDateRange, setInternalDateRange] = React.useState<{ startDate: Date; endDate: Date }>(() => {
    const now = new Date();
    const hours = defaultTimeRange.endsWith('h') ? parseInt(defaultTimeRange) || 48 : 48;
    const days = defaultTimeRange.endsWith('d') ? parseInt(defaultTimeRange) || 7 : 0;
    const startDate =
      days > 0
        ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - hours * 60 * 60 * 1000);
    return { startDate, endDate: now };
  });

  const dateRange = controlledDateRange ?? internalDateRange;
  const isControlled = controlledDateRange != null;

  const { metrics } = useNodePowerMetricsSuspense(internalId, dateRange);

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeLabel) return;
    setTimeRangeLabel(value);
    if (!isControlled) setInternalDateRange(timeRange);
  };

  const chartData = React.useMemo(() => {
    if (!metrics) return [];
    return metrics
      .filter((m) => m.reported_time != null)
      .map((m) => {
        const row: Record<string, number | null> = {
          timestamp: new Date(m.reported_time!).getTime(),
        };
        const mRecord = m as unknown as Record<string, number | null | undefined>;
        for (let n = 1; n <= 8; n++) {
          row[`ch${n}_voltage`] = mRecord[`ch${n}_voltage`] ?? null;
          row[`ch${n}_current`] = mRecord[`ch${n}_current`] ?? null;
        }
        return row;
      });
  }, [metrics]);

  const seriesWithData = React.useMemo(() => {
    const series: Array<{ dataKey: string; label: string; unit: string; color: string }> = [];
    for (let n = 1; n <= 8; n++) {
      const hasV = chartData.some((d) => (d[`ch${n}_voltage`] as number | null) != null);
      const hasC = chartData.some((d) => (d[`ch${n}_current`] as number | null) != null);
      const color = CHANNEL_COLORS[(n - 1) % CHANNEL_COLORS.length];
      if (hasV) series.push({ dataKey: `ch${n}_voltage`, label: `Ch${n} Voltage`, unit: 'V', color });
      if (hasC) series.push({ dataKey: `ch${n}_current`, label: `Ch${n} Current`, unit: 'A', color });
    }
    return series;
  }, [chartData]);

  const chartConfig: ChartConfig = React.useMemo(
    () => Object.fromEntries(seriesWithData.map((s) => [s.dataKey, { color: s.color, label: s.label }])),
    [seriesWithData]
  );

  if (chartData.length === 0 || seriesWithData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Power Metrics</CardTitle>
          <CardDescription>No power metrics data for this time range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Power Metrics</CardTitle>
        <CardDescription>Voltage and current per channel over time</CardDescription>
        {!isControlled && (
          <div className="absolute right-4 top-4">
            <TimeRangeSelect options={timeRangeOptions} value={timeRangeLabel} onChange={handleTimeRangeChange} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <CartesianGrid vertical={false} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value) => {
                const s = seriesWithData.find((c) => c.dataKey === value);
                return s ? `${s.label} (${s.unit})` : value;
              }}
            />
            <XAxis
              dataKey="timestamp"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              domain={[dateRange.startDate.getTime(), dateRange.endDate.getTime()]}
              tickFormatter={(value: number) =>
                new Date(value).toLocaleDateString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })
              }
              scale="time"
              type="number"
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={['auto', 'auto']} />
            <Tooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload?.timestamp) {
                      return new Date(payload[0].payload.timestamp).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      });
                    }
                    return 'Unknown time';
                  }}
                  formatter={(value, name) => {
                    const s = seriesWithData.find((c) => c.dataKey === name);
                    const num = typeof value === 'number' ? value : parseFloat(String(value));
                    const formatted = !isNaN(num) ? num.toFixed(2) : String(value);
                    return [s?.unit ? `${formatted} ${s.unit}` : formatted, s?.label ?? name];
                  }}
                />
              }
            />
            {seriesWithData.map((s) => (
              <Area
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={s.color}
                fill="none"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
