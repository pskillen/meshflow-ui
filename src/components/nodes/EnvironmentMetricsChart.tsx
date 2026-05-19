'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { useNodeEnvironmentMetricsSuspense } from '@/hooks/api/useNodes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnvironmentMetrics } from '@/lib/models';

const SERIES_CONFIG: Array<{
  dataKey: keyof EnvironmentMetrics;
  label: string;
  unit: string;
  color: string;
}> = [
  { dataKey: 'temperature', label: 'Temperature', unit: '°C', color: '#ff7b72' },
  { dataKey: 'relative_humidity', label: 'Humidity', unit: '%', color: '#79c0ff' },
  { dataKey: 'barometric_pressure', label: 'Pressure', unit: 'hPa', color: '#d0a8ff' },
  { dataKey: 'gas_resistance', label: 'Gas Resistance', unit: 'Ω', color: '#ffa657' },
  { dataKey: 'iaq', label: 'IAQ', unit: '', color: '#7ee787' },
  { dataKey: 'lux', label: 'Lux', unit: 'lx', color: '#ffcc66' },
  { dataKey: 'wind_speed', label: 'Wind Speed', unit: 'm/s', color: '#a371f7' },
  { dataKey: 'radiation', label: 'Radiation', unit: '', color: '#f97583' },
  { dataKey: 'rainfall_1h', label: 'Rainfall 1h', unit: 'mm', color: '#58a6ff' },
  { dataKey: 'rainfall_24h', label: 'Rainfall 24h', unit: 'mm', color: '#1f6feb' },
];

export interface DateRangeProp {
  startDate: Date;
  endDate: Date;
}

const X_AXIS_TICK_COUNT = 8;

interface EnvironmentMetricsChartProps {
  internalId: string;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
  /** When provided, use this date range instead of internal state (controlled mode). Hides the time range selector. */
  controlledDateRange?: DateRangeProp;
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

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
      <AreaChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          ticks={xTicks}
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
              formatter={(value) => {
                const num = typeof value === 'number' ? value : parseFloat(String(value));
                const formatted = !isNaN(num) ? num.toFixed(2) : String(value);
                return [unit ? `${formatted} ${unit}` : formatted, label];
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill="none"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function EnvironmentMetricsChart({
  internalId,
  timeRangeOptions = [
    { key: '24h', label: '24 hours' },
    { key: '48h', label: '48 hours' },
    { key: '7d', label: '7 days' },
    { key: '14d', label: '14 days' },
  ],
  defaultTimeRange = '48h',
  controlledDateRange,
}: EnvironmentMetricsChartProps) {
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

  const { metrics } = useNodeEnvironmentMetricsSuspense(internalId, dateRange);

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
        for (const s of SERIES_CONFIG) {
          const val = (m as unknown as Record<string, unknown>)[s.dataKey];
          row[s.dataKey] = typeof val === 'number' ? val : null;
        }
        return row;
      });
  }, [metrics]);

  const seriesWithData = React.useMemo(() => {
    return SERIES_CONFIG.filter((s) => chartData.some((d) => d[s.dataKey] != null));
  }, [chartData]);

  if (chartData.length === 0 || seriesWithData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Environment Metrics</CardTitle>
          <CardDescription>No environment metrics data for this time range</CardDescription>
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
        <CardTitle>Environment Metrics</CardTitle>
        <CardDescription>Temperature, humidity, pressure, and other environment metrics over time</CardDescription>
        {!isControlled && (
          <div className="absolute right-4 top-4">
            <TimeRangeSelect options={timeRangeOptions} value={timeRangeLabel} onChange={handleTimeRangeChange} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {/* Mobile: tabs/pills to switch between metrics */}
        <div className="md:hidden">
          <Tabs defaultValue={seriesWithData[0].dataKey} className="w-full">
            <TabsList className="mb-4 flex w-full flex-wrap gap-1 bg-muted p-1">
              {seriesWithData.map((s) => (
                <TabsTrigger key={s.dataKey} value={s.dataKey} className="flex-1 min-w-0 text-xs">
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {seriesWithData.map((s) => (
              <TabsContent key={s.dataKey} value={s.dataKey} className="mt-0">
                <SingleMetricChart
                  dataKey={s.dataKey}
                  label={s.label}
                  unit={s.unit}
                  color={s.color}
                  chartData={chartData}
                  dateRange={dateRange}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* md and lg: grid of charts - 3 per row on md, 4 per row on lg */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seriesWithData.map((s) => (
            <div key={s.dataKey} className="rounded-lg border border-border bg-muted/30 p-3">
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                {s.label}
                {s.unit && ` (${s.unit})`}
              </h4>
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
      </CardContent>
    </Card>
  );
}
