'use client';

import { NodePacketTypeCard } from '@/components/nodes/NodePacketTypeCard';
import type { StatsRange } from '@/hooks/useStatsRange';

/** Packets this (managed) node heard, by type, over the page's range. A thin wrapper on `NodePacketTypeCard`. */
export function ReceivedPacketTypeChart({ nodeId, range }: { nodeId: number; range: StatsRange }) {
  return <NodePacketTypeCard nodeId={nodeId} range={range} direction="received" />;
}
