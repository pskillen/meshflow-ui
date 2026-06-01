import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ResolvedHop } from '@/lib/models';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { cn } from '@/lib/utils';

function hopIsLinkable(hop: ResolvedHop): boolean {
  return hop.status === 'resolved' && Boolean(hop.node_id_str?.trim());
}

function hopLabel(hop: ResolvedHop): string {
  return hop.long_name?.trim() || hop.hash;
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

  const wrapped =
    hop.ambiguous && unknown ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{badge}</span>
          </TooltipTrigger>
          <TooltipContent>Multiple matches possible</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      badge
    );

  if (!hopIsLinkable(hop)) {
    return wrapped;
  }

  const path = nodeDetailPath({
    node_id_str: hop.node_id_str!,
    internal_id: hop.internal_id ?? undefined,
    protocol: 2,
  });

  if (!path) {
    return wrapped;
  }

  return (
    <Link
      to={path}
      className="inline-flex max-w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={(e) => e.stopPropagation()}
    >
      {wrapped}
    </Link>
  );
}
