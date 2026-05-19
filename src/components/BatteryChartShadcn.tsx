'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceArea,
  Text,
  type XAxisTickContentProps,
} from 'recharts';
import { useNodeMetricsSuspense } from '@/hooks/api/useNodes';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { Formatter, NameType, ValueType, Payload } from 'recharts/types/component/DefaultTooltipContent';

// Extended payload type with activeLabel
interface ExtendedPayload extends Payload<ValueType, NameType> {
  activeLabel?: number;
}

export interface DateRangeProp {
  startDate: Date;
  endDate: Date;
}

const X_AXIS_TICK_COUNT = 8;

export type BatteryDisplayMode = 'voltage' | 'percentage';

interface BatteryChartShadcnProps {
  internalId: string;
  timeRangeOptions?: TimeRangeOption[];
  defaultTimeRange?: string;
  /** When provided, use this date range instead of internal state (controlled mode). Hides the time range selector. */
  controlledDateRange?: DateRangeProp;
  /** Battery Y-axis display: voltage (V) or percentage (%). */
  displayMode?: BatteryDisplayMode;
}

export function BatteryChartShadcn({
  internalId,
  timeRangeOptions = [
    { key: '24h', label: '24 hours' },
    { key: '48h', label: '48 hours' },
    { key: '1d', label: 'Today' },
    { key: '2d', label: '2 days' },
    { key: '7d', label: '7 days' },
    { key: '14d', label: '14 days' },
  ],
  defaultTimeRange = '48h',
  controlledDateRange,
  displayMode: controlledDisplayMode,
}: BatteryChartShadcnProps) {
  const [timeRangeLabel, setTimeRangeLabel] = React.useState(defaultTimeRange);
  const [internalDateRange, setInternalDateRange] = React.useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    endDate: new Date(),
  });
  const displayMode = controlledDisplayMode ?? 'voltage';

  const dateRange = controlledDateRange ?? internalDateRange;
  const isControlled = controlledDateRange != null;

  const { metrics } = useNodeMetricsSuspense(internalId, dateRange);

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeLabel) return;
    setTimeRangeLabel(value);
    if (!isControlled) setInternalDateRange(timeRange);
  };

  const chartConfig: ChartConfig = {
    value: {
      color: 'var(--color-value)',
      label: 'Value',
    },
  };

  // Helper for ReferenceArea shading
  const getShadingAreas = () => {
    if (displayMode === 'voltage') {
      return [
        { y1: 3.0, y2: 3.3, color: 'rgba(255,0,0,0.15)' },
        { y1: 3.3, y2: 3.6, color: 'rgba(255,255,0,0.10)' },
        { y1: 3.6, y2: 4.2, color: 'rgba(0,255,0,0.08)' },
        { y1: 4.2, y2: 4.3, color: 'rgba(255,0,0,0.10)' },
      ];
    } else {
      return [
        { y1: 0, y2: 20, color: 'rgba(255,0,0,0.15)' },
        { y1: 20, y2: 40, color: 'rgba(255,255,0,0.10)' },
        { y1: 40, y2: 100, color: 'rgba(0,255,0,0.08)' },
      ];
    }
  };

  // Formatter for tooltip and axis
  const formatter: Formatter<ValueType, NameType> = (value, name) => {
    if (value === undefined) return ['', name];
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue !== 'number') return [String(value), name];
    if (displayMode === 'voltage' && name === 'voltage') {
      return [`${numValue.toFixed(2)}V`, 'Voltage'];
    } else if (displayMode === 'percentage' && name === 'batteryLevel') {
      return [`${numValue.toFixed(1)}%`, 'Battery Level'];
    } else if (name === 'chUtil') {
      return [`${numValue.toFixed(1)}%`, 'Channel Utilization'];
    } else if (name === 'airUtil') {
      return [`${numValue.toFixed(1)}%`, 'Air Utilization'];
    }
    return [String(value), name];
  };

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

  // Transform metrics data to chart format (skip metrics without reported_time)
  const chartData = React.useMemo(() => {
    if (!metrics) return [];
    return metrics
      .filter((metric: import('@/lib/models').DeviceMetrics) => metric.reported_time != null)
      .map((metric: import('@/lib/models').DeviceMetrics) => ({
        timestamp: metric.reported_time!.getTime(),
        voltage: metric.voltage,
        batteryLevel: metric.battery_level,
        chUtil: metric.meshtastic_channel_utilization,
        airUtil: metric.meshtastic_air_util_tx,
      }));
  }, [metrics]);

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Battery & Utilization</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Battery voltage, level, and channel utilization over time</span>
        </CardDescription>
        {!isControlled && (
          <div className="absolute right-4 top-4">
            <TimeRangeSelect options={timeRangeOptions} value={timeRangeLabel} onChange={handleTimeRangeChange} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="voltageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d0a8ff" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#d0a8ff" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="batteryLevelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#76d9c4" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#76d9c4" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            {/* Shading bands */}
            {getShadingAreas().map((area, idx) => (
              <ReferenceArea
                key={idx}
                yAxisId={displayMode === 'voltage' ? 'voltage' : 'battery'}
                y1={area.y1}
                y2={area.y2}
                stroke={undefined}
                fill={area.color}
                ifOverflow="extendDomain"
              />
            ))}
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value) => {
                switch (value) {
                  case 'voltage':
                    return 'Voltage (V)';
                  case 'batteryLevel':
                    return 'Battery Level (%)';
                  case 'chUtil':
                    return 'Channel Utilization (%)';
                  case 'airUtil':
                    return 'Air Utilization (%)';
                  default:
                    return value;
                }
              }}
            />
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
                return date.toLocaleDateString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              }}
              scale="time"
              type="number"
            />
            <YAxis
              yAxisId="voltage"
              orientation="right"
              domain={[3.0, 4.2]}
              tickFormatter={(value) => `${value}V`}
              hide={displayMode !== 'voltage'}
            />
            <YAxis
              yAxisId="battery"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              hide={displayMode !== 'percentage'}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload: readonly Payload<ValueType, NameType>[]) => {
                    // Extract the timestamp from the activeLabel property
                    if (payload && payload[0] && payload[0].payload && payload[0].payload.timestamp) {
                      const date = new Date(payload[0].payload.timestamp);
                      return date.toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      });
                    }
                    // If we can't find the timestamp in the payload, use the activeLabel
                    const extendedPayload = payload as ExtendedPayload[];
                    if (extendedPayload && extendedPayload[0] && extendedPayload[0].activeLabel) {
                      const date = new Date(extendedPayload[0].activeLabel);
                      return date.toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      });
                    }
                    // Fallback if we can't find any timestamp
                    return 'Unknown time';
                  }}
                  formatter={formatter}
                />
              }
            />
            {displayMode === 'voltage' && (
              <Area yAxisId="voltage" type="monotone" dataKey="voltage" stroke="#d0a8ff" fill="none" strokeWidth={2} />
            )}
            {displayMode === 'percentage' && (
              <Area
                yAxisId="battery"
                type="monotone"
                dataKey="batteryLevel"
                stroke="#76d9c4"
                fill="none"
                strokeWidth={2}
              />
            )}
            <Area
              yAxisId={displayMode === 'voltage' ? 'battery' : 'battery'}
              type="monotone"
              dataKey="chUtil"
              stroke="#ff7b72"
              fill="none"
              dot={{ r: 4 }}
            />
            <Area
              yAxisId={displayMode === 'voltage' ? 'battery' : 'battery'}
              type="monotone"
              dataKey="airUtil"
              stroke="#ffa657"
              fill="none"
              dot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
