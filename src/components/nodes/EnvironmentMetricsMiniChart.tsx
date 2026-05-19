import * as React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Text, type XAxisTickContentProps } from 'recharts';
import { EnvironmentMetrics } from '@/lib/models';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Formatter, NameType, ValueType, Payload } from 'recharts/types/component/DefaultTooltipContent';

const MINI_SERIES: Array<{
  dataKey: keyof EnvironmentMetrics;
  label: string;
  unit: string;
  color: string;
}> = [
  { dataKey: 'temperature', label: 'Temp', unit: '°C', color: '#ff7b72' },
  { dataKey: 'relative_humidity', label: 'RH', unit: '%', color: '#79c0ff' },
  { dataKey: 'barometric_pressure', label: 'Pressure', unit: 'hPa', color: '#d0a8ff' },
];

const X_AXIS_TICK_COUNT = 4;

interface EnvironmentMetricsMiniChartProps {
  metrics: EnvironmentMetrics[];
  dateRange: { startDate: Date; endDate: Date };
}

function SingleMetricChart({
  dataKey,
  label,
  unit,
  color,
  chartData,
  dateRange,
}: {
  dataKey: string;
  label: string;
  unit: string;
  color: string;
  chartData: Array<Record<string, number | null>>;
  dateRange: { startDate: Date; endDate: Date };
}) {
  const chartConfig: ChartConfig = { [dataKey]: { color, label } };

  const xTicks = React.useMemo(() => {
    const start = dateRange.startDate.getTime();
    const end = dateRange.endDate.getTime();
    const ticks: number[] = [];
    for (let i = 0; i <= X_AXIS_TICK_COUNT; i++) {
      ticks.push(start + (end - start) * (i / X_AXIS_TICK_COUNT));
    }
    return ticks;
  }, [dateRange.startDate, dateRange.endDate]);

  const renderXAxisTick = React.useCallback(
    (props: XAxisTickContentProps) => {
      const { payload, tickFormatter } = props;
      const x = Number(props.x);
      const y = Number(props.y);
      if (!payload || typeof payload.value !== 'number') return <g />;
      const isOurTick = xTicks.some((t) => Math.abs(t - payload.value) < 60_000);
      if (!isOurTick) return <g />;
      const value = tickFormatter ? tickFormatter(payload.value, 0) : String(payload.value);
      return (
        <Text
          x={x}
          y={y}
          textAnchor="end"
          verticalAnchor="start"
          angle={-35}
          className="recharts-cartesian-axis-tick-value"
        >
          {value}
        </Text>
      );
    },
    [xTicks]
  );

  const formatter: Formatter<ValueType, NameType> = (value, name) => {
    if (value === undefined) return ['', name];
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue !== 'number' || isNaN(numValue)) return ['-', label];
    const formatted = numValue.toFixed(1);
    return [unit ? `${formatted} ${unit}` : formatted, label];
  };

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[100px] w-full min-w-0">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" className="opacity-50" />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          ticks={xTicks}
          tick={renderXAxisTick}
          interval={0}
          domain={[dateRange.startDate.getTime(), dateRange.endDate.getTime()]}
          tickFormatter={(value: number) => {
            const date = new Date(value);
            return date.toLocaleString('en-GB', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          }}
          scale="time"
          type="number"
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={28} domain={['auto', 'auto']} />
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
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} connectNulls />
      </LineChart>
    </ChartContainer>
  );
}

export function EnvironmentMetricsMiniChart({ metrics, dateRange }: EnvironmentMetricsMiniChartProps) {
  const chartData = React.useMemo(() => {
    return metrics
      .filter((m) => m.reported_time != null)
      .map((m) => {
        const row: Record<string, number | null> = {
          timestamp: new Date(m.reported_time!).getTime(),
        };
        for (const s of MINI_SERIES) {
          const val = (m as unknown as Record<string, unknown>)[s.dataKey];
          row[s.dataKey] = typeof val === 'number' ? val : null;
        }
        return row;
      })
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }, [metrics]);

  const seriesWithData = React.useMemo(
    () => MINI_SERIES.filter((s) => chartData.some((d) => d[s.dataKey] != null)),
    [chartData]
  );

  if (chartData.length === 0 || seriesWithData.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground rounded border border-dashed">
        No data
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {seriesWithData.map((s) => (
        <div key={s.dataKey} className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
          <SingleMetricChart
            dataKey={s.dataKey}
            label={s.label}
            unit={s.unit}
            color={s.color}
            chartData={chartData}
            dateRange={dateRange}
          />
        </div>
      ))}
    </div>
  );
}
