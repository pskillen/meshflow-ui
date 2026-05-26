'use client';

import * as React from 'react';
import { subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeRangeSelect, TimeRangeOption } from '@/components/TimeRangeSelect';
import { OnlineNodesChart } from '@/components/OnlineNodesChart';
import { PacketStatsChartFromSnapshots } from '@/components/PacketStatsChartFromSnapshots';
import { ChartConfig } from '@/components/ui/chart';
import { Link } from 'react-router-dom';
import { MC_PACKET_TYPE_DISPLAY_NAMES, type MeshStatsProtocolScope } from '@/lib/stats-snapshot-types';
import { PACKET_TYPE_DISPLAY_NAMES } from '@/lib/stats-aggregation';

const MESH_STATS_TIME_OPTIONS: TimeRangeOption[] = [
  { key: '48h', label: 'Last 48 hours' },
  { key: '1d', label: 'Today' },
  { key: '2d', label: 'Last 2 days' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

const OVERLAY_CHART_CONFIG = {
  meshtastic: { label: 'Meshtastic', color: 'hsl(var(--chart-1))' },
  meshcore: { label: 'MeshCore', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

const SINGLE_SERIES_CONFIG = {
  value: { label: 'Count', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const PACKET_TYPE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220 70% 50%)',
  'hsl(280 60% 55%)',
];

function buildPacketTypeChartConfig(labels: Record<string, string>): ChartConfig {
  return {
    value: { label: 'Packets', color: 'hsl(var(--chart-2))' },
    ...Object.fromEntries(
      Object.keys(labels).map((k, i) => [
        k,
        { label: labels[k], color: PACKET_TYPE_COLORS[i % PACKET_TYPE_COLORS.length] },
      ])
    ),
  };
}

const SECTION_COPY: Record<
  MeshStatsProtocolScope,
  { title: string; description: string; links?: { href: string; label: string }[] }
> = {
  both: {
    title: 'Mesh stats',
    description:
      'Meshtastic and MeshCore activity from hourly snapshots. Online nodes use a 2h window; new nodes are daily totals.',
  },
  meshtastic: {
    title: 'Meshtastic stats',
    description: 'Packet and node activity on the Meshtastic mesh (hourly snapshots).',
    links: [
      { href: '/messages', label: 'Messages' },
      { href: '/nodes', label: 'Nodes' },
    ],
  },
  meshcore: {
    title: 'MeshCore stats',
    description: 'Packet and node activity on the MeshCore mesh (hourly snapshots).',
    links: [
      { href: '/meshcore/messages', label: 'Messages' },
      { href: '/meshcore/nodes', label: 'Nodes' },
    ],
  },
};

export function MeshStatsSection({ protocolScope = 'both' }: { protocolScope?: MeshStatsProtocolScope }) {
  const [timeRangeKey, setTimeRangeKey] = React.useState('2d');
  const [dateRange, setDateRange] = React.useState<{ startDate: Date; endDate: Date }>({
    startDate: subDays(new Date(), 2),
    endDate: new Date(),
  });

  const handleTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    if (value === timeRangeKey) return;
    setTimeRangeKey(value);
    setDateRange(timeRange);
  };

  const copy = SECTION_COPY[protocolScope];
  const nodeChartConfig = protocolScope === 'both' ? OVERLAY_CHART_CONFIG : SINGLE_SERIES_CONFIG;
  const packetChartConfig =
    protocolScope === 'meshcore'
      ? buildPacketTypeChartConfig(MC_PACKET_TYPE_DISPLAY_NAMES)
      : buildPacketTypeChartConfig(PACKET_TYPE_DISPLAY_NAMES);

  return (
    <Card data-testid="dashboard-mesh-stats">
      <CardHeader className="relative">
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {copy.description}
          {copy.links?.length ? (
            <span className="mt-2 block">
              {copy.links.map((link, i) => (
                <React.Fragment key={link.href}>
                  {i > 0 ? ' · ' : ''}
                  <Link to={link.href} className="underline underline-offset-2">
                    {link.label}
                  </Link>
                </React.Fragment>
              ))}
            </span>
          ) : null}
        </CardDescription>
        <div className="absolute right-4 top-4">
          <TimeRangeSelect options={MESH_STATS_TIME_OPTIONS} value={timeRangeKey} onChange={handleTimeRangeChange} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <OnlineNodesChart
          title="Online Nodes"
          description="Nodes heard within 2h"
          metric="online_nodes"
          protocolScope={protocolScope}
          config={nodeChartConfig}
          embedded
          dateRange={dateRange}
          movingAverage={protocolScope !== 'both'}
        />
        <OnlineNodesChart
          title="New Nodes"
          description="Newly discovered nodes per day"
          metric="new_nodes"
          protocolScope={protocolScope}
          config={nodeChartConfig}
          embedded
          dateRange={dateRange}
          movingAverage={false}
        />
        <PacketStatsChartFromSnapshots
          title="Packet volume"
          description="Packets per hour (or aggregated window)"
          config={protocolScope === 'both' ? OVERLAY_CHART_CONFIG : packetChartConfig}
          protocolScope={protocolScope}
          embedded
          dateRange={dateRange}
        />
      </CardContent>
    </Card>
  );
}
