import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useClaimFromPrevious } from '@/hooks/api/useNodeIdentityLinks';
import type { NodeIdentityRef } from '@/lib/models';
import { identityLinkErrorMessage } from './identityLinkErrors';

/** Claim-specific wording. `evidence_too_weak` and `already_claimed` are not errors: they send the owner to the normal claim. */
const CLAIM_MESSAGES: Record<string, string> = {
  not_owner: 'You can only do this for a radio whose older number you own.',
  no_previous: "Meshflow doesn't have an older number of yours linked to this node.",
  not_found: 'That node was not found. It may have been removed.',
};

type ClaimStatus =
  | { kind: 'idle' }
  | { kind: 'done' }
  | { kind: 'fallback'; code: 'evidence_too_weak' | 'already_claimed' }
  | { kind: 'error'; message: string };

function errorCode(err: unknown): string | undefined {
  const body = typeof err === 'object' && err !== null ? (err as { data?: unknown }).data : undefined;
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : undefined;
}

/**
 * "This is mine too": claims the newer node of a replaced radio in one tap, for the owner of the older one.
 * When Meshflow is not sure enough (or someone else holds the new node) it says so plainly and points to the normal
 * claim page instead. See ClaimFromPreviousButton.md.
 */
export function ClaimFromPreviousButton({ newer, onDone }: { newer: NodeIdentityRef; onDone?: () => void }) {
  const claim = useClaimFromPrevious(newer.internal_id);
  const [status, setStatus] = useState<ClaimStatus>({ kind: 'idle' });
  // Synchronous guard: `isPending` only updates on the next render, so a fast double-click would send twice.
  const inFlight = useRef(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const outcome = status.kind === 'done' || status.kind === 'fallback';

  // The button is swapped out for the outcome: move focus there so keyboard users are not dropped on <body>.
  useEffect(() => {
    if (outcome) outcomeRef.current?.focus();
  }, [outcome]);

  return (
    <div className="space-y-2" data-testid="claim-from-previous">
      {outcome ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={claim.isPending}
          aria-label={`This is mine too, node ${newer.node_id_str}`}
          title={`Claim node ${newer.node_id_str} too, because it is the same radio`}
          onClick={() => {
            if (inFlight.current) return;
            inFlight.current = true;
            setStatus({ kind: 'idle' });
            claim.mutate(undefined, {
              onSuccess: () => {
                setStatus({ kind: 'done' });
                onDone?.();
              },
              onError: (err) => {
                const code = errorCode(err);
                if (code === 'evidence_too_weak' || code === 'already_claimed') {
                  setStatus({ kind: 'fallback', code });
                } else {
                  setStatus({
                    kind: 'error',
                    message:
                      (code && CLAIM_MESSAGES[code]) || identityLinkErrorMessage(err, 'Could not claim it. Try again.'),
                  });
                }
              },
              onSettled: () => {
                inFlight.current = false;
              },
            });
          }}
        >
          This is mine too
        </Button>
      )}
      {/* Always mounted, so the outcome is announced when its text appears (and outlives the show/hide rule). */}
      <div
        ref={outcomeRef}
        tabIndex={-1}
        role="status"
        className="space-y-1 text-sm outline-none"
        data-testid="claim-from-previous-outcome"
      >
        {status.kind === 'done' ? (
          <p data-testid="claim-from-previous-done">Done. Node {newer.node_id_str} is now yours too.</p>
        ) : null}
        {status.kind === 'fallback' ? (
          <div data-testid="claim-from-previous-fallback">
            <p>
              {status.code === 'evidence_too_weak'
                ? `Meshflow can't tell for certain that node ${newer.node_id_str} is the same radio, so it can't hand it over in one tap. You can still claim it the usual way.`
                : `Node ${newer.node_id_str} has already been claimed. If it is yours, claim it the usual way.`}
            </p>
            <Link
              to={`/nodes/${newer.internal_id}/claim`}
              className="font-medium underline underline-offset-4"
              data-testid="claim-from-previous-link"
            >
              Claim node {newer.node_id_str}
            </Link>
          </div>
        ) : null}
      </div>
      {status.kind === 'error' ? (
        <Alert variant="destructive" className="text-foreground">
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
