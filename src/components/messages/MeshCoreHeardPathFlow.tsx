import { Badge } from '@/components/ui/badge';
import { HopPositionIcon } from './HopPositionIcon';
import { PathHopChain } from './PathHopChain';
import type { MeshCoreHeardLeg } from './heard-path-map-adapters';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export type MeshCoreHeardPathFlowProps = {
  leg: MeshCoreHeardLeg;
  senderDisplayLabel: string;
  senderKnown: boolean;
  senderHasPosition?: boolean;
  senderDetailPath?: string | null;
};

export function MeshCoreHeardPathFlow({
  leg,
  senderDisplayLabel,
  senderKnown,
  senderHasPosition = false,
  senderDetailPath = null,
}: MeshCoreHeardPathFlowProps) {
  const senderLabel = senderKnown
    ? senderDisplayLabel
    : `Sender unknown${senderDisplayLabel ? ` (${senderDisplayLabel})` : ''}`;

  const senderBadge = (
    <Badge
      variant={senderKnown ? 'secondary' : 'outline'}
      className={cn(!senderKnown && 'border-dashed text-muted-foreground')}
    >
      {senderLabel}
    </Badge>
  );

  const startBadge = (
    <span className="inline-flex items-center gap-1">
      <HopPositionIcon positioned={senderHasPosition} />
      {senderKnown && senderDetailPath ? (
        <Link to={senderDetailPath} className="inline-flex hover:underline">
          {senderBadge}
        </Link>
      ) : (
        senderBadge
      )}
    </span>
  );

  const endBadge = (
    <span className="inline-flex items-center gap-1">
      <HopPositionIcon positioned={leg.receiverPosition != null} />
      <Badge variant="secondary" className="max-w-full" style={{ borderColor: leg.lineColor }}>
        {leg.receiverLabel}
      </Badge>
    </span>
  );

  if (leg.hops.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm" data-testid={`heard-path-flow-${leg.receiverLabel}`}>
        {startBadge}
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {endBadge}
        <span className="w-full text-xs text-muted-foreground italic mt-1">No path recorded for this observation</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-sm" data-testid={`heard-path-flow-${leg.receiverLabel}`}>
      {startBadge}
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <PathHopChain hops={leg.hops} />
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {endBadge}
    </div>
  );
}
