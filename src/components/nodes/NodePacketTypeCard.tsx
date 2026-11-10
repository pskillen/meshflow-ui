'use client';

import * as React from 'react';
import { ChartCard } from '@/components/stats/ChartCard';
import { TrendChart } from '@/components/stats/TrendChart';
import { usePacketStatsSuspense, useReceivedPacketStatsSuspense } from '@/hooks/api/usePacketStats';
import type { StatsRange } from '@/hooks/useStatsRange';
import type { GlobalStats } from '@/lib/models';
import { buildPacketTypeRows, NODE_PACKET_TYPE_SERIES, packetIntervalType } from '@/lib/node-packet-series';
import { metricQueryEnd } from '@/lib/node-metric-series';
import { bucketPhrase, formatTrendLabel } from '@/lib/stats-trend';

export type NodePacketDirection = 'sent' | 'received';

const COPY: Record<NodePacketDirection, { title: string; blurb: string; testId: string; none: string }> = {
  sent: {
    title: 'Sent packets',
    blurb: 'Packets sent by this node which were received by another node and reported to Meshflow.',
    testId: 'chart-node-packets-sent',
    none: 'sent',
  },
  received: {
    title: 'Heard packets',
    blurb: 'Packets heard by this node and reported to Meshflow.',
    testId: 'chart-node-packets-received',
    none: 'heard',
  },
};

const nf = new Intl.NumberFormat('en-GB');

export interface NodePacketTypeCardProps {
  nodeId: number;
  range: StatsRange;
  direction: NodePacketDirection;
}

/** The query: hourly for 24h and 7d (7d is rolled up to 6 hours here), daily for 30d and 90d; ends past the hour. */
function usePacketParams(nodeId: number, range: StatsRange) {
  const { window, bucket } = range;
  return React.useMemo(
    () => ({
      nodeId,
      startDate: window.start,
      endDate: metricQueryEnd(window),
      interval: 1,
      intervalType: packetIntervalType(bucket),
    }),
    [nodeId, window, bucket]
  );
}

/**
 * Packets sent or heard by one node over the page's range, stacked by packet type, one bar per range bucket.
 * See NodePacketTypeCard.md.
 */
export function NodePacketTypeCard({ nodeId, range, direction }: NodePacketTypeCardProps) {
  return direction === 'sent' ? (
    <SentBody nodeId={nodeId} range={range} />
  ) : (
    <ReceivedBody nodeId={nodeId} range={range} />
  );
}

function SentBody({ nodeId, range }: { nodeId: number; range: StatsRange }) {
  const { stats } = usePacketStatsSuspense(usePacketParams(nodeId, range));
  return <PacketTypeBody stats={stats} range={range} direction="sent" />;
}

function ReceivedBody({ nodeId, range }: { nodeId: number; range: StatsRange }) {
  const { stats } = useReceivedPacketStatsSuspense(usePacketParams(nodeId, range));
  return <PacketTypeBody stats={stats} range={range} direction="received" />;
}

function PacketTypeBody({
  stats,
  range,
  direction,
}: {
  stats: GlobalStats;
  range: StatsRange;
  direction: NodePacketDirection;
}) {
  const { window, bucket } = range;
  const { rows, total } = React.useMemo(() => buildPacketTypeRows(stats, window, bucket), [stats, window, bucket]);
  const copy = COPY[direction];
  const hasPartial = rows.some((r) => r.partial);
  const latest = rows.length ? rows[rows.length - 1]! : undefined;
  const headline = `${nf.format(total)} packets`;

  return (
    <ChartCard
      title={copy.title}
      headline={total > 0 ? headline : undefined}
      measure={`Packets per ${bucketPhrase(bucket)}, by packet type`}
      note={
        <>
          {copy.blurb}
          {hasPartial ? ' Faded, dashed bar: the bucket in progress.' : ''}
          {latest && bucket !== 'daily' ? ` Latest bucket ${formatTrendLabel(latest.timestamp, bucket)}.` : ''}
        </>
      }
      data-testid={copy.testId}
    >
      {total > 0 ? (
        <TrendChart
          kind="bar"
          rows={rows}
          series={NODE_PACKET_TYPE_SERIES}
          window={window}
          bucket={bucket}
          label={`${copy.title}, ${range.longLabel}`}
          headline={headline}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-md bg-muted/40 px-3 text-center text-sm text-muted-foreground"
          style={{ height: 190 }}
          data-testid={`${copy.testId}-empty`}
        >
          No {copy.none} packets in the {range.longLabel}.
        </div>
      )}
    </ChartCard>
  );
}
