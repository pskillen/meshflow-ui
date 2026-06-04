import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ResolvedHop } from '@/lib/models';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { cn } from '@/lib/utils';
import { HopPositionIcon } from './HopPositionIcon';

function hopIsLinkable(hop: ResolvedHop): boolean {
  return hop.status === 'resolved' && Boolean(hop.node_id_str?.trim());
}

function hopLabel(hop: ResolvedHop): string {
  return hop.short_name?.trim() || hop.long_name?.trim() || hop.hash;
}

function hopTooltip(hop: ResolvedHop): string | null {
  if (hop.candidates && hop.candidates.length > 0) {
    const names = hop.candidates.map((c) => c.short_name || c.long_name || c.node_id_str).join(', ');
    return `${hop.candidates.length} possible nodes: ${names}`;
  }
  if (hop.ambiguous) {
    return 'Multiple matches possible';
  }
  return null;
}

export function PathHopBadge({ hop }: { hop: ResolvedHop }) {
  const unknown = hop.status === 'unknown' || !hopIsLinkable(hop);
  const badge = (
    <Badge
      variant={unknown ? 'outline' : 'secondary'}
      className={cn(
        'max-w-full font-mono text-xs',
        unknown && 'border-dashed text-muted-foreground',
        hopIsLinkable(hop) && 'cursor-pointer'
      )}
    >
      {hopLabel(hop)}
    </Badge>
  );

  const tooltipText = hopTooltip(hop);
  const wrappedBadge =
    tooltipText != null ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{badge}</span>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      badge
    );

  const content = (
    <span className="inline-flex items-center gap-1">
      <HopPositionIcon hop={hop} />
      {wrappedBadge}
    </span>
  );

  if (!hopIsLinkable(hop)) {
    return content;
  }

  const path = nodeDetailPath({
    node_id_str: hop.node_id_str!,
    internal_id: hop.internal_id ?? undefined,
    protocol: 2,
  });

  if (!path) {
    return content;
  }

  return (
    <Link
      to={path}
      className="inline-flex max-w-full items-center gap-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  );
}
