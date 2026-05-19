import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { RouteIcon, RotateCw } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TracerouteQueueDispatchCell } from '@/components/traceroutes/TracerouteQueueDispatchCell';
import { TracerouteStatusBadge } from '@/components/traceroutes/TracerouteStatusBadge';
import { useTracerouteTriggerableNodesSuspense, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import { useTraceroutesWithWebSocket } from '@/hooks/useTraceroutesWithWebSocket';
import { TracerouteElapsedCell } from '@/components/traceroutes/TracerouteElapsedCell';
import { TracerouteDetailModal } from '@/pages/traceroutes/TracerouteDetailModal';
import { getTracerouteErrorMessage } from '@/pages/traceroutes/tracerouteErrors';
import type { AutoTraceRoute, ManagedNode } from '@/lib/models';
import { labelForTriggerTypeApi } from '@/lib/traceroute-trigger-type';

const PAGE_SIZE = 10;

function routeSummary(tr: AutoTraceRoute): string {
  const outEmpty = !tr.route || tr.route.length === 0;
  const backEmpty = !tr.route_back || tr.route_back.length === 0;
  if (outEmpty && backEmpty) {
    return tr.status === 'completed' ? 'Direct' : '—';
  }
  const outStr = outEmpty ? 'Direct' : `${tr.route?.length ?? 0} hops`;
  const backStr = backEmpty ? 'Direct' : `${tr.route_back?.length ?? 0} hops`;
  return `${outStr} out, ${backStr} back`;
}

export interface NodeOutgoingTraceroutesSectionProps {
  nodeId: number;
  managed: ManagedNode;
}

export function NodeOutgoingTraceroutesSection({ nodeId, managed }: NodeOutgoingTraceroutesSectionProps) {
  void managed; // Prop kept for call-site stability; feeder geo pills removed (#197).
  const [selectedTracerouteId, setSelectedTracerouteId] = useState<number | null>(null);

  const { data, isLoading, error } = useTraceroutesWithWebSocket({
    source_node: nodeId,
    page_size: PAGE_SIZE,
  });
  const { triggerableNodes } = useTracerouteTriggerableNodesSuspense();
  const triggerMutation = useTriggerTraceroute();

  const traceroutes = data?.results ?? [];

  const handleRepeat = (tr: AutoTraceRoute) => {
    triggerMutation.mutate(
      {
        managedNodeId: tr.source_node.meshtastic_node_id,
        targetNodeId: tr.target_node.meshtastic_node_id,
        targetStrategy:
          tr.target_strategy === 'intra_zone' ||
          tr.target_strategy === 'dx_across' ||
          tr.target_strategy === 'dx_same_side'
            ? tr.target_strategy
            : undefined,
      },
      {
        onError: (err) => {
          toast.error('Traceroute failed', {
            description: getTracerouteErrorMessage(err),
          });
        },
      }
    );
  };

  const canTrigger = triggerableNodes.length > 0;

  return (
    <div className="mb-6">
      <Card data-testid="node-detail-outgoing-traceroutes">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Outgoing traceroutes
          </CardTitle>
          <CardDescription>
            Traceroutes initiated by this managed feeder toward other nodes. Click a row for the full path and map.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold leading-none">Recent runs</h3>
            {isLoading && <div className="py-6 text-center text-muted-foreground">Loading…</div>}
            {error && (
              <div className="py-6 text-center text-destructive">
                Failed to load traceroutes: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            )}
            {!isLoading && !error && traceroutes.length === 0 && (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                No outgoing traceroutes from this feeder yet.
              </div>
            )}
            {!isLoading && !error && traceroutes.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Triggered by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Queue / dispatch</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Triggered</TableHead>
                      <TableHead title="Time from triggered to completion (successful runs only)">Elapsed</TableHead>
                      {canTrigger ? <TableHead className="w-12" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traceroutes.map((tr) => {
                      const canRepeat = triggerableNodes.some(
                        (n) => n.meshtastic_node_id === tr.source_node.meshtastic_node_id
                      );
                      return (
                        <TableRow
                          key={tr.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedTracerouteId(tr.id)}
                        >
                          <TableCell>{tr.target_node?.short_name ?? tr.target_node?.node_id_str ?? '—'}</TableCell>
                          <TableCell>{labelForTriggerTypeApi(tr.trigger_type, tr.trigger_type_label)}</TableCell>
                          <TableCell>{tr.triggered_by_username ?? '—'}</TableCell>
                          <TableCell>
                            <TracerouteStatusBadge status={tr.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[160px]">
                            <TracerouteQueueDispatchCell tr={tr} />
                          </TableCell>
                          <TableCell className="max-w-[200px]" title={routeSummary(tr)}>
                            {routeSummary(tr)}
                          </TableCell>
                          <TableCell>{tr.triggered_at ? format(new Date(tr.triggered_at), 'PPp') : '—'}</TableCell>
                          <TableCell>
                            <TracerouteElapsedCell tr={tr} />
                          </TableCell>
                          {canTrigger ? (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {canRepeat ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRepeat(tr)}
                                  disabled={triggerMutation.isPending || tr.source_node.allow_auto_traceroute === false}
                                  title="Repeat this traceroute"
                                  aria-label="Repeat traceroute"
                                >
                                  <RotateCw className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="text-right">
                  <Link
                    to={`/traceroutes/history?source_node=${nodeId}`}
                    className="text-sm text-teal-600 hover:underline dark:text-teal-400"
                  >
                    View all traceroutes from this feeder →
                  </Link>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TracerouteDetailModal
        tracerouteId={selectedTracerouteId}
        open={selectedTracerouteId != null}
        onOpenChange={(open) => !open && setSelectedTracerouteId(null)}
      />
    </div>
  );
}
