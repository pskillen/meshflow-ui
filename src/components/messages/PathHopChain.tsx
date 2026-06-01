import type { ResolvedHop } from '@/lib/models';
import { PathHopBadge } from './PathHopBadge';
import { ArrowRight } from 'lucide-react';

export function PathHopChain({ hops, emptyLabel }: { hops: ResolvedHop[]; emptyLabel?: string }) {
  if (hops.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">
        {emptyLabel ?? 'No path recorded for this observation'}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="path-hop-chain">
      {hops.map((hop, index) => (
        <span key={`${hop.hash}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
          <PathHopBadge hop={hop} />
        </span>
      ))}
    </div>
  );
}
