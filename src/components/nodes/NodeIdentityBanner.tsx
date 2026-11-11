import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Info } from 'lucide-react';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import type { NodeIdentityChainEntry, NodeIdentityRef, ObservedNode } from '@/lib/models';

const EVIDENCE_TEXT: Record<string, string> = {
  public_key: 'same public key',
  feeder_rekey: 'the feeder reported the change',
  predicted_number: "the new number was predicted from this node's public key",
  mac: 'same hardware address',
  declared: 'the owner said so',
};

/** Plain-words reason an entry is linked to this node. */
function identityWhy(entry: Pick<NodeIdentityChainEntry, 'evidence' | 'state'>): string {
  const base = EVIDENCE_TEXT[entry.evidence] ?? 'linked by Meshflow';
  const confirmed = entry.state === 'confirmed' && entry.evidence !== 'declared';
  const text = confirmed ? `${base}, confirmed by staff` : base;
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

function dayText(date: Date | null | undefined): string | null {
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
}

function IdLink({ target }: { target: NodeIdentityRef }) {
  const to = nodeDetailPath(target);
  return to ? (
    <Link to={to} className="font-mono underline underline-offset-4">
      {target.node_id_str}
    </Link>
  ) : (
    <span className="font-mono">{target.node_id_str}</span>
  );
}

function Why({ entry }: { entry: NodeIdentityChainEntry }) {
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Why?</summary>
      <p>{identityWhy(entry)}</p>
    </details>
  );
}

function ReplacedLine({ node, compact }: { node: ObservedNode; compact: boolean }) {
  const next = node.identity_chain?.next ?? [];
  const newest = next[next.length - 1];
  const target = node.replaced_by!;
  const name = newest?.long_name || newest?.short_name;
  const heard = newest?.last_heard;
  const upTo = dayText(next[0]?.linked_at);
  return (
    <div
      className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
      role="status"
      data-testid="node-identity-replaced"
    >
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong>
            This radio now uses node <IdLink target={target} />
          </strong>
          {name ? ` (${name})` : ''}.{heard ? ` Heard ${formatDistanceToNow(heard, { addSuffix: true })}.` : ''}
          {compact ? null : (
            <>
              {' '}
              <Link
                to={nodeDetailPath(target) ?? '#'}
                className="font-medium underline underline-offset-4"
                data-testid="node-identity-go"
              >
                Go to {target.node_id_str}
              </Link>
            </>
          )}
        </span>
      </p>
      {compact ? null : (
        <>
          {upTo ? (
            <p className="mt-1">{`History up to ${upTo} is on this page; newer history is on the new one.`}</p>
          ) : null}
          {next[0] ? <Why entry={next[0]} /> : null}
        </>
      )}
    </div>
  );
}

function SuccessorLine({ node, compact }: { node: ObservedNode; compact: boolean }) {
  const first = node.identity_chain!.next[0];
  const from = dayText(first.linked_at);
  const to = dayText(first.last_heard);
  return (
    <div className="text-sm text-muted-foreground" data-testid="node-identity-successor">
      <p>
        This radio also used node <IdLink target={first} />
        {from ? ` from ${from}` : ''}
        {to ? ` to ${to}` : ''}.
      </p>
      {compact ? null : <Why entry={first} />}
    </div>
  );
}

function PreviousLine({ node, compact }: { node: ObservedNode; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const previous = node.identity_chain!.previous;
  const rest = previous.slice(1);
  return (
    <div className="text-sm text-muted-foreground" data-testid="node-identity-previous">
      <p>
        Previously node <IdLink target={previous[0]} />
        {rest.length > 0 ? (
          compact ? (
            ` (and ${rest.length} more)`
          ) : (
            <>
              {' ('}
              <button
                type="button"
                className="underline underline-offset-4"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                and {rest.length} more
              </button>
              )
            </>
          )
        ) : null}
        . Older history is on {rest.length > 0 ? 'those pages' : 'that page'}.
      </p>
      {open && !compact ? (
        <ul className="ml-4 list-disc" data-testid="node-identity-previous-list">
          {rest.map((p) => (
            <li key={p.internal_id}>
              <IdLink target={p} />
              {p.long_name || p.short_name ? ` (${p.long_name || p.short_name})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {compact ? null : <Why entry={previous[0]} />}
    </div>
  );
}

/**
 * Tells a viewer about the other numbers this radio has used. Renders nothing on an older API (no fields) or when
 * both lists are empty. `compact` shows only the single most important line, without disclosures.
 * See NodeIdentityBanner.md.
 */
export function NodeIdentityBanner({ node, compact = false }: { node: ObservedNode; compact?: boolean }) {
  const next = node.identity_chain?.next ?? [];
  const previous = node.identity_chain?.previous ?? [];
  const replaced = !!node.replaced_by;
  if (!replaced && next.length === 0 && previous.length === 0) return null;

  if (compact) {
    // Compact (sheet) shows only the prominent banner; the quiet lines stay on the full page.
    if (!replaced) return null;
    return (
      <div className="mb-3" data-testid="node-identity-banner">
        <ReplacedLine node={node} compact />
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2" data-testid="node-identity-banner">
      {replaced ? <ReplacedLine node={node} compact={false} /> : null}
      {!replaced && next.length > 0 ? <SuccessorLine node={node} compact={false} /> : null}
      {previous.length > 0 ? <PreviousLine node={node} compact={false} /> : null}
    </div>
  );
}
