'use client';

import { NodePacketTypeCard } from '@/components/nodes/NodePacketTypeCard';
import type { StatsRange } from '@/hooks/useStatsRange';

/** Packets this node sent, by type, over the page's range. A thin wrapper on `NodePacketTypeCard`. */
export function PacketTypeChart({ nodeId, range }: { nodeId: number; range: StatsRange }) {
  return <NodePacketTypeCard nodeId={nodeId} range={range} direction="sent" />;
}
