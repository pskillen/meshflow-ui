import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { nodeDetailPath, observedNodeDetailPath } from '@/lib/node-detail-routes';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useTraceroute } from '@/hooks/api/useTraceroutes';
import { TracerouteFlowDiagram } from '@/components/traceroutes/TracerouteFlowDiagram';
import { TracerouteMap } from '@/components/traceroutes/TracerouteMap';
import type { AutoTraceRoute } from '@/lib/models';
import { tracerouteStatusLabel } from '@/lib/traceroute-status';

function displayStatus(tr: Pick<AutoTraceRoute, 'status'>): string {
  return tracerouteStatusLabel(tr.status);
}

function DispatchMetadataSection({ traceroute }: { traceroute: AutoTraceRoute }) {
  const attempts = traceroute.dispatch_attempts ?? 0;
  const hasDispatchError = traceroute.dispatch_error != null && traceroute.dispatch_error !== '';
  const show =
    traceroute.earliest_send_at != null || traceroute.dispatched_at != null || attempts > 0 || hasDispatchError;
  if (!show) return null;

  return (
    <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-2 text-sm">
      <h3 className="font-medium text-foreground">Dispatch queue</h3>
      <dl className="grid gap-2 sm:grid-cols-2">
        {traceroute.earliest_send_at != null && traceroute.earliest_send_at !== '' && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Earliest send</dt>
            <dd className="tabular-nums">{format(new Date(traceroute.earliest_send_at), 'PPpp')}</dd>
          </div>
        )}
        {traceroute.dispatched_at != null && traceroute.dispatched_at !== '' && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Dispatched to source</dt>
            <dd className="tabular-nums">{format(new Date(traceroute.dispatched_at), 'PPpp')}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Dispatch attempts</dt>
          <dd className="tabular-nums">{attempts}</dd>
        </div>
        {hasDispatchError && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-destructive">Dispatch error</dt>
            <dd className="mt-1 font-mono text-xs text-destructive break-words">{traceroute.dispatch_error}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

interface TracerouteDetailModalProps {
  tracerouteId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TracerouteDetailModal({ tracerouteId, open, onOpenChange }: TracerouteDetailModalProps) {
  const { data: traceroute, isLoading, error } = useTraceroute(open ? tracerouteId : null);

  const isEmptyRouteArrays =
    traceroute &&
    (!traceroute.route || traceroute.route.length === 0) &&
    (!traceroute.route_back || traceroute.route_back.length === 0);
  const hasRouteData =
    traceroute &&
    ((traceroute.route_nodes && traceroute.route_nodes.length > 0) ||
      (traceroute.route_back_nodes && traceroute.route_back_nodes.length > 0) ||
      (traceroute.status === 'completed' && isEmptyRouteArrays));

  const hasSourceOrTargetPosition =
    traceroute &&
    (() => {
      const src = traceroute.source_node?.position;
      const tgt = traceroute.target_node?.latest_position;
      return (src?.latitude != null && src?.longitude != null) || (tgt?.latitude != null && tgt?.longitude != null);
    })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traceroute Details</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {traceroute ? (
              <>
                <Link
                  to={
                    nodeDetailPath({
                      meshtastic_node_id: traceroute.source_node.meshtastic_node_id,
                      node_id_str: traceroute.source_node.node_id_str,
                      protocol: traceroute.source_node.protocol,
                    }) ?? '#'
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {traceroute.source_node?.short_name ?? traceroute.source_node?.node_id_str}
                </Link>
                <span aria-hidden>→</span>
                <Link
                  to={observedNodeDetailPath(traceroute.target_node) ?? '#'}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {traceroute.target_node?.short_name ?? traceroute.target_node?.node_id_str}
                </Link>
              </>
            ) : (
              'Loading...'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading && <div className="py-8 text-center text-muted-foreground">Loading traceroute...</div>}
        {error && (
          <div className="py-8 text-center text-destructive">
            Failed to load: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}
        {traceroute && !isLoading && !error && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Source:</span>
                <Link
                  to={
                    nodeDetailPath({
                      meshtastic_node_id: traceroute.source_node.meshtastic_node_id,
                      node_id_str: traceroute.source_node.node_id_str,
                      protocol: traceroute.source_node.protocol,
                    }) ?? '#'
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {traceroute.source_node?.short_name ?? traceroute.source_node?.node_id_str}
                </Link>
              </Badge>
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Target:</span>
                <Link
                  to={observedNodeDetailPath(traceroute.target_node) ?? '#'}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {traceroute.target_node?.short_name ?? traceroute.target_node?.node_id_str}
                </Link>
              </Badge>
              <Badge>{displayStatus(traceroute)}</Badge>
              <span className="text-sm text-muted-foreground">
                Triggered {traceroute.triggered_at ? format(new Date(traceroute.triggered_at), 'PPp') : '—'}
                {traceroute.completed_at &&
                  ` • ${traceroute.status === 'failed' ? 'Failed' : 'Completed'} ${format(new Date(traceroute.completed_at), 'PPp')}`}
              </span>
            </div>

            <DispatchMetadataSection traceroute={traceroute} />

            {hasRouteData && (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Flow</h3>
                  <TracerouteFlowDiagram traceroute={traceroute} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Map</h3>
                  <div className="h-[400px] overflow-hidden rounded-md border">
                    <TracerouteMap traceroute={traceroute} />
                  </div>
                </div>
              </>
            )}

            {hasSourceOrTargetPosition && !hasRouteData && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Map</h3>
                <div className="h-[400px] overflow-hidden rounded-md border">
                  <TracerouteMap traceroute={traceroute} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {displayStatus(traceroute)} — showing known node positions
                </p>
              </div>
            )}

            {traceroute &&
              !hasRouteData &&
              !hasSourceOrTargetPosition &&
              traceroute.route === null &&
              traceroute.route_back === null && (
                <p className="text-sm text-muted-foreground">{displayStatus(traceroute)} — no route data yet</p>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
