import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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
  number_collision: 'Another feeder already uses that number. Contact an administrator.',
};

/** Prefer the API's own message over a generic one. */
function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    const data = err.response.data as Record<string, unknown>;
    for (const key of ['error', 'detail', 'message']) {
      if (typeof data[key] === 'string' && data[key]) return data[key] as string;
    }
    if (data.code === 'number_collision') return REASON_LINES.number_collision;
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

  const needsReview = event.outcome === 'flagged' && event.needs_action;
  const canRepoint = needsReview && event.reason !== 'number_collision';
  const detailPath = nodeDetailPath({
    meshtastic_node_id: event.new_meshtastic_node_id,
    node_id_str: event.new_node_id_str,
    protocol: 1,
  });

  const openConfirm = () => {
    setRepointError(null);
    setConfirmOpen(true);
  };

  const confirmRepoint = () => {
    setRepointError(null);
    repoint.mutate(event.managed_node, {
      onSuccess: () => setConfirmOpen(false),
      onError: (err) => setRepointError(apiErrorMessage(err)),
    });
  };

  return (
    <>
      <Alert variant={needsReview ? 'destructive' : 'default'} data-testid="feeder-identity-notice">
        {needsReview ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        <AlertTitle>{needsReview ? 'Feeder needs review' : 'Feeder number changed'}</AlertTitle>
        <AlertDescription>
          {needsReview ? (
            <>
              <p>
                {event.managed_node_name} reported <NodeId id={event.new_node_id_str} /> but is stored as{' '}
                <NodeId id={event.old_node_id_str} />.
              </p>
              {event.reason && <p>{REASON_LINES[event.reason]}</p>}
              <p>Packets from this feeder are still being ingested.</p>
            </>
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
              onClick={() => acknowledge.mutate(event.id)}
            >
              Dismiss
            </Button>
            {detailPath && (
              <Link to={detailPath} className="text-sm underline underline-offset-4">
                View feeder
              </Link>
            )}
          </div>
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
              <Alert variant="destructive">
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

/** Notices on My Nodes when a feeder's Meshtastic number changed. Renders nothing on error or no events. */
export function FeederIdentityNotices() {
  const { data, isError } = useFeederIdentityEvents();

  const events = useMemo(() => {
    const rows = (data?.results ?? []).filter((e) => e.outcome !== 'key_changed');
    return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [data]);

  if (isError || events.length === 0) return null;

  const shown = events.slice(0, MAX_NOTICES);
  const hidden = events.length - shown.length;

  return (
    <div className="space-y-3" data-testid="feeder-identity-notices">
      {shown.map((event) => (
        <FeederIdentityNotice key={event.id} event={event} />
      ))}
      {hidden > 0 && <p className="text-sm text-muted-foreground">and {hidden} more</p>}
    </div>
  );
}
