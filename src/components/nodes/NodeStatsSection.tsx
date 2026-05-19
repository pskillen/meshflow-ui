'use client';

import * as React from 'react';
import { subHours, subDays, startOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BatteryChartShadcn, type BatteryDisplayMode } from '@/components/BatteryChartShadcn';
import { EnvironmentMetricsChart } from '@/components/nodes/EnvironmentMetricsChart';
import { PowerMetricsChart } from '@/components/nodes/PowerMetricsChart';
import { PacketTypeChart } from '@/components/PacketTypeChart';
import { ReceivedPacketTypeChart } from '@/components/ReceivedPacketTypeChart';
import { NeighbourPieChart } from '@/components/NeighbourPieChart';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import type { ObservedNode } from '@/lib/models';

const STATS_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { key: '24h', label: '24 hours' },
  { key: '48h', label: '48 hours' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
];

function computeDateRange(value: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  if (value.endsWith('d')) {
    const days = parseInt(value);
    const startDate = days === 1 ? startOfDay(now) : subDays(startOfDay(now), days);
    return { startDate, endDate: now };
  }
  if (value.endsWith('h')) {
    const hours = parseInt(value);
    return { startDate: subHours(now, hours), endDate: now };
  }
  return { startDate: subDays(now, 7), endDate: now };
}

interface NodeStatsSectionProps {
  internalId: string;
  node: ObservedNode;
  isManagedNode: boolean;
}

export function NodeStatsSection({ internalId, node, isManagedNode }: NodeStatsSectionProps) {
  const meshtasticNodeId = node.meshtastic_node_id;
  const [timeRange, setTimeRange] = React.useState('48h');
  const [dateRange, setDateRange] = React.useState(() => computeDateRange('48h'));
  const [batteryDisplayMode, setBatteryDisplayMode] = React.useState<BatteryDisplayMode>('voltage');

  const controlledDateRange = { startDate: dateRange.startDate, endDate: dateRange.endDate };

  const chartFallback = (
    <Card>
      <CardHeader>
        <CardTitle>Loading</CardTitle>
        <CardDescription>Loading chart…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-center justify-center bg-muted rounded-md">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Node Statistics</CardTitle>
            <CardDescription>
              Battery, environment, power, and packet metrics over time. Use the time range selector to filter all
              charts.
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[140px]">
            <TimeRangeSelect
              options={STATS_TIME_RANGE_OPTIONS}
              value={timeRange}
              onChange={(value, range) => {
                setTimeRange(value);
                setDateRange(range);
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Battery chart</span>
              <ToggleGroup
                type="single"
                value={batteryDisplayMode}
                onValueChange={(v) => v && setBatteryDisplayMode(v as BatteryDisplayMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="voltage" aria-label="Show voltage (V)">
                  Voltage
                </ToggleGroupItem>
                <ToggleGroupItem value="percentage" aria-label="Show percentage (%)">
                  Percentage
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Suspense fallback={chartFallback}>
              <BatteryChartShadcn
                internalId={internalId}
                defaultTimeRange="48h"
                controlledDateRange={controlledDateRange}
                displayMode={batteryDisplayMode}
              />
            </Suspense>
          </div>

          {node.latest_environment_metrics && (
            <Suspense fallback={chartFallback}>
              <EnvironmentMetricsChart
                internalId={internalId}
                defaultTimeRange="48h"
                controlledDateRange={controlledDateRange}
              />
            </Suspense>
          )}

          {node.latest_power_metrics && (
            <Suspense fallback={chartFallback}>
              <PowerMetricsChart
                internalId={internalId}
                defaultTimeRange="48h"
                controlledDateRange={controlledDateRange}
              />
            </Suspense>
          )}

          <Suspense fallback={chartFallback}>
            <PacketTypeChart
              nodeId={meshtasticNodeId}
              defaultTimeRange="48h"
              controlledDateRange={controlledDateRange}
            />
          </Suspense>

          {isManagedNode && (
            <>
              <Suspense fallback={chartFallback}>
                <ReceivedPacketTypeChart
                  nodeId={meshtasticNodeId}
                  defaultTimeRange="48h"
                  controlledDateRange={controlledDateRange}
                />
              </Suspense>
              <NeighbourStatsWithLoad nodeId={meshtasticNodeId} controlledDateRange={controlledDateRange} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NeighbourStatsWithLoad({
  nodeId,
  controlledDateRange,
}: {
  nodeId: number;
  controlledDateRange: { startDate: Date; endDate: Date };
}) {
  const [showChart, setShowChart] = React.useState(false);

  if (!showChart) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6">
        <p className="text-sm text-muted-foreground mb-3">
          Packets received from each neighbour (direct or last hop). Click to load.
        </p>
        <Button onClick={() => setShowChart(true)} variant="outline">
          Load packets by source
        </Button>
      </div>
    );
  }

  return <NeighbourPieChart nodeId={nodeId} defaultTimeRange="48h" controlledDateRange={controlledDateRange} />;
}
