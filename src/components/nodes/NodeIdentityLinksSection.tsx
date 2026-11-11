import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useConfirmNodeIdentityLink,
  useNodeIdentityLinks,
  useRejectNodeIdentityLink,
} from '@/hooks/api/useNodeIdentityLinks';
import { authService } from '@/lib/auth/authService';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { isMeshCoreObservedNode } from '@/lib/observed-node-capabilities';
import type { NodeIdentityLink, NodeIdentityLinkNode, ObservedNode } from '@/lib/models';
import { DeclareReplacementDialog } from './DeclareReplacementDialog';
import { identityLinkErrorMessage } from './identityLinkErrors';

const STATE_TEXT: Record<string, string> = {
  suggested: 'suggested by Meshflow',
  auto: 'linked by Meshflow',
  confirmed: 'confirmed',
  rejected: 'marked not the same radio',
  flagged: 'held for staff to review',
};

const REASON_TEXT: Record<string, string> = {
  public_key: 'same public key',
  feeder_rekey: 'the feeder reported the change',
  predicted_number: "the new number was predicted from this node's public key",
  mac: 'same hardware address',
  declared: 'the owner said so',
};

/** Suggested first (they need a decision), then live links, rejected last. */
function rank(link: NodeIdentityLink): number {
  if (link.state === 'suggested') return 0;
  if (link.state === 'rejected') return 3;
  if (link.state === 'flagged') return 2;
  return 1;
}

function sortLinks(links: NodeIdentityLink[]): NodeIdentityLink[] {
  return [...links].sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
}

function OtherNode({ node }: { node: NodeIdentityLinkNode }) {
  const to = nodeDetailPath(node);
  const name = node.long_name || node.short_name;
  return (
    <>
      {to ? (
        <Link to={to} className="font-mono underline underline-offset-4">
          {node.node_id_str}
        </Link>
      ) : (
        <span className="font-mono">{node.node_id_str}</span>
      )}
      {name ? ` (${name})` : ''}
    </>
  );
}

function LinkRow({ link, internalId }: { link: NodeIdentityLink; internalId: string }) {
  const confirm = useConfirmNodeIdentityLink();
  const reject = useRejectNodeIdentityLink();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard: `isPending` only updates on the next render, so a fast double-click would send twice.
  const inFlight = useRef(false);

  const isOld = link.old.internal_id === internalId;
  const other = isOld ? link.new : link.old;
  const reason = REASON_TEXT[link.evidence] ?? 'linked by Meshflow';
  const stateText = STATE_TEXT[link.state] ?? link.state;
  const busy = confirm.isPending || reject.isPending;

  const run = (mutate: typeof confirm.mutate, onDone?: () => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    mutate(link.id, {
      onSuccess: onDone,
      onError: (err) => setError(identityLinkErrorMessage(err, 'Could not save that. Try again.')),
      onSettled: () => {
        inFlight.current = false;
      },
    });
  };

  return (
    <li className="py-3" data-testid="node-identity-link" data-state={link.state}>
      <p className="text-sm">
        {link.state === 'rejected' ? 'Not the same radio as node ' : 'Same radio as node '}
        <OtherNode node={other} />
        <span className="text-muted-foreground">
          {' '}
          ({reason}; {isOld ? 'the newer number' : 'the older number'})
        </span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge variant={link.state === 'suggested' ? 'outline' : 'secondary'}>{stateText}</Badge>
        {link.can_confirm ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => run(confirm.mutate)}>
            Confirm
          </Button>
        ) : null}
        {link.can_reject ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setError(null);
              setRejectOpen(true);
            }}
          >
            Not the same radio
          </Button>
        ) : null}
      </div>
      {error && !rejectOpen ? (
        <Alert variant="destructive" className="mt-2 text-foreground" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {link.can_reject ? (
        <Dialog open={rejectOpen} onOpenChange={(open) => !reject.isPending && setRejectOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Not the same radio?</DialogTitle>
              <DialogDescription>
                Node {other.node_id_str} will no longer be shown as the same radio as{' '}
                {isOld ? link.old.node_id_str : link.new.node_id_str}.
              </DialogDescription>
            </DialogHeader>
            {error ? (
              <Alert variant="destructive" className="text-foreground" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={reject.isPending} onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={reject.isPending}
                onClick={() => run(reject.mutate, () => setRejectOpen(false))}
              >
                Yes, not the same radio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </li>
  );
}

/**
 * Review of a node's identity links, for its owner and for staff. Renders nothing for guests and other users, and
 * makes no request for them. See NodeIdentityLinksSection.md.
 */
export function NodeIdentityLinksSection({ node, internalId }: { node: ObservedNode; internalId: string }) {
  const user = authService.getCurrentUser();
  const isMeshCore = isMeshCoreObservedNode(node);
  const allowed = !!user && !isMeshCore && (Boolean(user.is_staff) || node.owner?.id === user.id);
  const links = useNodeIdentityLinks(internalId, allowed);

  if (!allowed) return null;
  // An older API (404) or a failed load: show nothing rather than a broken section.
  if (links.isError || links.isLoading) return null;

  const sorted = sortLinks(links.data ?? []);

  return (
    <section className="mb-6 rounded-md border p-4" data-testid="node-identity-links">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Other numbers for this radio</h2>
        <DeclareReplacementDialog internalId={internalId} node={node} isStaff={Boolean(user.is_staff)} />
      </div>
      {sorted.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing linked. If this radio now uses a different node number, you can say so.
        </p>
      ) : (
        <ul className="mt-1 divide-y">
          {sorted.map((link) => (
            <LinkRow key={link.id} link={link} internalId={internalId} />
          ))}
        </ul>
      )}
    </section>
  );
}
