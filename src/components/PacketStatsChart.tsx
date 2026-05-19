'use client';

import * as React from 'react';
import { CartesianGrid, XAxis, YAxis, Bar, Line, ComposedChart } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { usePacketStatsSuspense } from '@/hooks/api/usePacketStats';
import { subDays } from 'date-fns';
import { Payload, ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

interface PacketStatsChartProps {
  nodeId?: number;
  title: string;
  description?: string;
  config: ChartConfig;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
}

export function PacketStatsChart({
  nodeId,
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
}: PacketStatsChartProps) {
  const [timeRangeLabel, setTimeRangeLabel] = React.useState(defaultTimeRange);
  const [dateRange, setDateRange] = React.useState<{ startDate: Date; endDate: Date }>({
    startDate: subDays(new Date(), 2), // Default to 2 days ago
    endDate: new Date(),
  });

  const statsParams = React.useMemo(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...(nodeId != null && { nodeId }),
    }),
    [dateRange.startDate, dateRange.endDate, nodeId]
  );

  const { stats: packetStats } = usePacketStatsSuspense(statsParams);

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeLabel) return;
    setTimeRangeLabel(value);
    setDateRange(timeRange);
  };

  // Transform the data for the chart from live stats API
  const chartData = React.useMemo(() => {
    if (!packetStats?.intervals) return [];
    const stats = packetStats.intervals.map((stat) => ({
      timestamp: new Date(stat.start_date).getTime(),
      value: stat.packets >= 0 ? stat.packets : 0,
    }));
    const windowSize = 24;
    return stats.map((stat, index) => {
      const startIdx = Math.max(0, index - windowSize + 1);
      const window = stats.slice(startIdx, index + 1);
      const avg = window.length > 0 ? window.reduce((acc, i) => acc + i.value, 0) / window.length : 0;
      return { ...stat, movingAverage: avg };
    });
  }, [packetStats]);

  // Calculate y-axis domain with 5 std dev clamp
  const yAxisDomain = React.useMemo(() => {
    if (!chartData.length) return [0, 'auto'] as [number, 'auto'];

    // Calculate mean and standard deviation
    const values = chartData.map((item) => item.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Set max to mean + 5*stdDev, but not less than the actual max
    const maxValue = Math.max(mean + 5 * stdDev, Math.max(...values));

    return [0, maxValue] as [number, number];
  }, [chartData]);

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
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
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
              tickFormatter={(value) => {
                // Convert number to Date for display
                const date = new Date(value);
                return date.toLocaleDateString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                });
              }}
            />
            <YAxis domain={yAxisDomain} tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload: readonly Payload<ValueType, NameType>[]) => {
                    // Extract the timestamp from the payload
                    if (payload && payload[0] && payload[0].payload) {
                      const timestamp = payload[0].payload.timestamp;
                      // Convert number to Date for display
                      const date = new Date(timestamp);
                      return date.toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      });
                    }
                    return 'Unknown time';
                  }}
                  indicator="dot"
                />
              }
            />
            <Bar dataKey="value" fill="var(--color-value)" fillOpacity={0.7} barSize={8} />
            <Line
              type="monotone"
              dataKey="movingAverage"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
              name="24h Moving Average"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
