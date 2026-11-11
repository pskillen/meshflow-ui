import { Link } from 'react-router-dom';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import type { NodeIdentityRef } from '@/lib/models';
import { cn } from '@/lib/utils';

/**
 * Small "Replaced → !id" tag for a node whose radio now uses another number. The id links to the new node.
 * Renders nothing when `replacedBy` is absent (older API or not replaced). See ReplacedTag.md.
 */
export function ReplacedTag({
  replacedBy,
  label = 'Replaced',
  className,
}: {
  replacedBy: NodeIdentityRef | null | undefined;
  /** Text before the id. Lists use "Replaced" (with an arrow); the My nodes card says "Replaced by". */
  label?: string;
  className?: string;
}) {
  if (!replacedBy) return null;
  const to = nodeDetailPath(replacedBy);
  const arrow = label === 'Replaced' ? ' →' : '';
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-xs text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
        className
      )}
      data-testid="replaced-tag"
    >
      {label}
      {arrow}{' '}
      {to ? (
        <Link
          to={to}
          className="font-mono underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${replacedBy.node_id_str}, the node that replaced this one`}
        >
          {replacedBy.node_id_str}
        </Link>
      ) : (
        <span className="font-mono">{replacedBy.node_id_str}</span>
      )}
    </span>
  );
}
