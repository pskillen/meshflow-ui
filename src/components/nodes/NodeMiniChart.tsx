import * as React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { DeviceMetrics } from '@/lib/models';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Formatter, NameType, ValueType, Payload } from 'recharts/types/component/DefaultTooltipContent';

interface NodeMiniChartProps {
  metrics: DeviceMetrics[];
  dateRange: { startDate: Date; endDate: Date };
  /** When `battery`, only the battery % series is drawn (e.g. compact watch cards). */
  lines?: 'all' | 'battery';
}

const chartConfig: ChartConfig = {
  battery_level: { color: '#76d9c4', label: 'Battery %' },
  channel_utilization: { color: '#ff7b72', label: 'Ch. util %' },
};

export function NodeMiniChart({ metrics, dateRange, lines = 'all' }: NodeMiniChartProps) {
  const chartData = React.useMemo(() => {
    return metrics
      .filter((m) => m.reported_time != null)
      .map((m) => ({
        timestamp: new Date(m.reported_time!).getTime(),
        battery_level: m.battery_level,
        channel_utilization: m.channel_utilization,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [metrics]);

  const formatter: Formatter<ValueType, NameType> = (value, name) => {
    if (value === undefined) return ['', name];
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue !== 'number' || isNaN(numValue)) return ['-', name];
    return [`${numValue.toFixed(1)}%`, name];
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground rounded border border-dashed">
        No data
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[120px] w-full min-w-0">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" className="opacity-50" />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          minTickGap={24}
          domain={[dateRange.startDate.getTime(), dateRange.endDate.getTime()]}
          tickFormatter={(value: number) => {
            const date = new Date(value);
            return date.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          }}
          scale="time"
          type="number"
          tick={{ fontSize: 10 }}
        />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} width={28} />
        <Tooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload: readonly Payload<ValueType, NameType>[]) => {
                if (payload?.[0]?.payload?.timestamp) {
                  const date = new Date(payload[0].payload.timestamp);
                  return date.toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  });
                }
                return '';
              }}
              formatter={formatter}
            />
          }
        />
        <Line type="monotone" dataKey="battery_level" stroke="#76d9c4" strokeWidth={1.5} dot={false} connectNulls />
        {lines === 'all' ? (
          <Line
            type="monotone"
            dataKey="channel_utilization"
            stroke="#ff7b72"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
