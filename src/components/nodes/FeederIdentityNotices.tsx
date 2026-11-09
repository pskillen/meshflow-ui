import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  useAcknowledgeFeederIdentityEvent,
  useFeederIdentityEvents,
  useRepointManagedNode,
} from '@/hooks/api/useFeederIdentityEvents';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import type { FeederIdentityEvent, FeederIdentityReason } from '@/lib/models';

const MAX_NOTICES = 5;

const REASON_LINES: Record<FeederIdentityReason, string> = {
  auto_rekey_disabled: 'Automatic updates are off on this server.',
  shared_key: 'Its public key is also used by another node.',
  key_mismatch: 'Its public key has changed.',
  crc_mismatch: "Its number doesn't match its public key, so this may be a different radio.",
  key_not_reported: "It didn't report a public key.",
  number_collision: 'Another feeder already uses that number.',
};

/** Reasons where an owner's re-point is always refused (the stored key can't prove the new number). */
const REPOINT_UNAVAILABLE_REASONS: ReadonlySet<FeederIdentityReason> = new Set([
  'number_collision',
  'key_mismatch',
  'crc_mismatch',
]);

/** Extra guidance for reasons where Re-point is hidden. */
const NO_REPOINT_LINES: Partial<Record<FeederIdentityReason, string>> = {
  number_collision: 'Contact an administrator.',
  key_mismatch: "You can't re-point it yourself. Contact an administrator.",
  crc_mismatch: "You can't re-point it yourself. Contact an administrator.",
};

const REPOINT_CODE_MESSAGES: Record<string, string> = {
  repoint_not_proven:
    "This number can't be confirmed from the feeder's stored public key, so you can't re-point it yourself. Contact an administrator.",
  repoint_target_key_mismatch:
    'Another node already uses that number with a different public key, so it was not changed. Contact an administrator.',
  repoint_target_claimed:
    'That number already belongs to another user, so it was not changed. Contact an administrator.',
  number_collision: 'Another feeder already uses that number. Contact an administrator.',
};

/**
 * Plain message for a failed re-point: known codes first, then the API's own text, then a generic one.
 * The API client's interceptor turns failures into `{ message, status, data }` (or `NotFoundError` with `data`),
 * so the response body is read from `data`, not from an axios `response`.
 */
function apiErrorMessage(err: unknown): string {
  const body = typeof err === 'object' && err !== null ? (err as { data?: unknown }).data : undefined;
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    if (typeof data.code === 'string' && REPOINT_CODE_MESSAGES[data.code]) return REPOINT_CODE_MESSAGES[data.code];
    for (const key of ['error', 'detail', 'message']) {
      if (typeof data[key] === 'string' && data[key]) return data[key] as string;
    }
    if (typeof data.code === 'string' && data.code) return `The server refused the change (${data.code}).`;
  }
  return 'Could not re-point this feeder. Try again.';
}

function NodeId({ id }: { id: string }) {
  return <span className="font-mono">{id}</span>;
}

function FeederIdentityNotice({ event }: { event: FeederIdentityEvent }) {
  const acknowledge = useAcknowledgeFeederIdentityEvent();
  const repoint = useRepointManagedNode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [repointError, setRepointError] = useState<string | null>(null);
  const [dismissError, setDismissError] = useState(false);
  // Synchronous guards: `isPending` only updates on the next render, so a fast double-click gets through.
  const repointInFlight = useRef(false);
  const dismissInFlight = useRef(false);

  const flagged = event.outcome === 'flagged';
  const needsReview = flagged && event.needs_action;
  const resolvedFlag = flagged && !event.needs_action;
  const canRepoint = needsReview && !(event.reason && REPOINT_UNAVAILABLE_REASONS.has(event.reason));
  // A flagged feeder is still stored under the old number; the new one only exists once applied.
  const linkNumber = flagged
    ? { meshtastic_node_id: event.old_meshtastic_node_id, node_id_str: event.old_node_id_str }
    : { meshtastic_node_id: event.new_meshtastic_node_id, node_id_str: event.new_node_id_str };
  const detailPath = nodeDetailPath({ ...linkNumber, protocol: 1 });
  const sameNumber = event.old_node_id_str === event.new_node_id_str;

  const openConfirm = () => {
    setRepointError(null);
    setConfirmOpen(true);
  };

  const confirmRepoint = () => {
    if (repointInFlight.current) return;
    repointInFlight.current = true;
    setRepointError(null);
    repoint.mutate(event.managed_node, {
      onSuccess: () => setConfirmOpen(false),
      onError: (err) => setRepointError(apiErrorMessage(err)),
      onSettled: () => {
        repointInFlight.current = false;
      },
    });
  };

  const dismiss = () => {
    if (dismissInFlight.current) return;
    dismissInFlight.current = true;
    setDismissError(false);
    acknowledge.mutate(event.id, {
      onError: () => setDismissError(true),
      onSettled: () => {
        dismissInFlight.current = false;
      },
    });
  };

  return (
    <>
      <Alert
        variant={needsReview ? 'destructive' : 'default'}
        role={needsReview ? 'alert' : 'status'}
        // Destructive text on the page background is too low-contrast for body copy: keep the red border, icon and title.
        className={needsReview ? 'text-foreground' : undefined}
        data-testid="feeder-identity-notice"
      >
        {needsReview ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        <AlertTitle className={needsReview ? 'text-destructive' : undefined}>
          {needsReview ? 'Feeder needs review' : resolvedFlag ? 'Feeder review resolved' : 'Feeder number changed'}
        </AlertTitle>
        <AlertDescription>
          {needsReview ? (
            <>
              <p>
                {sameNumber ? (
                  <>
                    {event.managed_node_name} reported a different public key for <NodeId id={event.old_node_id_str} />.
                  </>
                ) : (
                  <>
                    {event.managed_node_name} reported <NodeId id={event.new_node_id_str} /> but is stored as{' '}
                    <NodeId id={event.old_node_id_str} />.
                  </>
                )}
              </p>
              {event.reason && (
                <p>
                  {REASON_LINES[event.reason]}
                  {!canRepoint && NO_REPOINT_LINES[event.reason] && ` ${NO_REPOINT_LINES[event.reason]}`}
                </p>
              )}
              <p>Packets from this feeder are still being ingested.</p>
            </>
          ) : resolvedFlag ? (
            <p>
              A number change for {event.managed_node_name} (<NodeId id={event.old_node_id_str} /> to{' '}
              <NodeId id={event.new_node_id_str} />) was flagged for review and has since been resolved.
            </p>
          ) : (
            <p>
              {event.managed_node_name} changed from <NodeId id={event.old_node_id_str} /> to{' '}
              <NodeId id={event.new_node_id_str} />.
              {event.outcome === 'auto_updated' && ' It keeps its history and API key.'}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canRepoint && (
              <Button size="sm" onClick={openConfirm}>
                Re-point to {event.new_node_id_str}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={acknowledge.isPending}
              onClick={dismiss}
              aria-label={`Dismiss notice for ${event.managed_node_name}`}
            >
              Dismiss
            </Button>
            {detailPath && (
              <Link
                to={detailPath}
                className="text-sm underline underline-offset-4"
                aria-label={`View feeder ${event.managed_node_name}`}
              >
                View feeder
              </Link>
            )}
          </div>
          {dismissError && <p className="mt-2">Could not dismiss this notice. Try again.</p>}
        </AlertDescription>
      </Alert>

      {canRepoint && (
        <Dialog open={confirmOpen} onOpenChange={(open) => !repoint.isPending && setConfirmOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Re-point feeder?</DialogTitle>
              <DialogDescription>
                {event.managed_node_name} will be stored as {event.new_node_id_str} instead of {event.old_node_id_str}.
                It keeps its history and API key.
              </DialogDescription>
            </DialogHeader>
            {repointError && (
              <Alert variant="destructive" className="text-foreground">
                <AlertDescription>{repointError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={repoint.isPending}>
                Cancel
              </Button>
              <Button onClick={confirmRepoint} disabled={repoint.isPending}>
                {repoint.isPending ? 'Re-pointing…' : 'Confirm re-point'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * Notices on My Nodes when a feeder's Meshtastic number changed. Renders nothing on error or no events.
 * `ownedManagedNodeIds` (internal ids from the user's own managed-node list) limits notices to their own feeders:
 * the API returns every owner's events to staff.
 */
export function FeederIdentityNotices({ ownedManagedNodeIds }: { ownedManagedNodeIds: readonly string[] }) {
  const { data, isError } = useFeederIdentityEvents();

  const events = useMemo(() => {
    const owned = new Set(ownedManagedNodeIds);
    const rows = (data?.results ?? []).filter((e) => e.outcome !== 'key_changed' && owned.has(e.managed_node));
    return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [data, ownedManagedNodeIds]);

  if (isError || events.length === 0) return null;

  const shown = events.slice(0, MAX_NOTICES);
  // Events beyond the first page (data.count > results.length) are counted too.
  const beyondPage = Math.max(0, (data?.count ?? 0) - (data?.results.length ?? 0));
  const hidden = events.length - shown.length + beyondPage;

  return (
    <div className="space-y-3" data-testid="feeder-identity-notices">
      {shown.map((event) => (
        <FeederIdentityNotice key={event.id} event={event} />
      ))}
      {hidden > 0 && <p className="text-sm text-muted-foreground">and {hidden} more</p>}
    </div>
  );
}
