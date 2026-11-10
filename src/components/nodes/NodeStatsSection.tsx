'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BatteryChartShadcn } from '@/components/BatteryChartShadcn';
import { ChannelAirChart } from '@/components/nodes/ChannelAirChart';
import { EnvironmentMetricsChart } from '@/components/nodes/EnvironmentMetricsChart';
import { PowerMetricsChart } from '@/components/nodes/PowerMetricsChart';
import { PacketTypeChart } from '@/components/PacketTypeChart';
import { ReceivedPacketTypeChart } from '@/components/ReceivedPacketTypeChart';
import { NeighbourPieChart } from '@/components/NeighbourPieChart';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import type { ObservedNode } from '@/lib/models';
import type { StatsRange } from '@/hooks/useStatsRange';

interface NodeStatsSectionProps {
  internalId: string;
  node: ObservedNode;
  isManagedNode: boolean;
  /** The page's shared range (`useStatsRange`); its bar is in the node header. */
  range: StatsRange;
}

export function NodeStatsSection({ internalId, node, isManagedNode, range }: NodeStatsSectionProps) {
  const meshtasticNodeId = node.meshtastic_node_id;

  // Stable object: the range window only moves when the key or the hour does. The old charts round `endDate` up to
  // the next hour; `window.end` is the top of the current hour, so without the extra hour they would stop short of
  // the newest data.
  const controlledDateRange = React.useMemo(
    () => ({ startDate: range.window.start, endDate: new Date(range.window.end.getTime() + 60 * 60 * 1000) }),
    [range.window]
  );

  const chartFallback = (
    <Card>
      <CardHeader>
        <CardTitle>Loading</CardTitle>
        <CardDescription>Loading chart…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-center justify-center bg-muted rounded-md">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>Over the {range.longLabel}</CardTitle>
            <CardDescription>
              Battery, environment, power, and packet metrics. All charts share the range chosen at the top of the page.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2" data-testid="node-metric-charts">
            <Suspense fallback={chartFallback}>
              <BatteryChartShadcn internalId={internalId} range={range} />
            </Suspense>
            <Suspense fallback={chartFallback}>
              <ChannelAirChart internalId={internalId} range={range} />
            </Suspense>
            {node.latest_environment_metrics && (
              <Suspense fallback={chartFallback}>
                <EnvironmentMetricsChart internalId={internalId} range={range} />
              </Suspense>
            )}
            {node.latest_power_metrics && (
              <Suspense fallback={chartFallback}>
                <PowerMetricsChart internalId={internalId} range={range} />
              </Suspense>
            )}
          </div>

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
