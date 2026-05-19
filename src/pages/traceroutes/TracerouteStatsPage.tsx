import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ListIcon, RouteIcon } from 'lucide-react';
import { TracerouteStatsSection } from '@/components/traceroutes/TracerouteStatsSection';
import { useTracerouteTriggerableNodesSuspense, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import { useManagedNodesSuspense, useNodesSuspense } from '@/hooks/api/useNodes';
import { TriggerTracerouteModal, TriggerMode } from './TriggerTracerouteModal';
import { getTracerouteErrorMessage } from './tracerouteErrors';

function parseNumberParam(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function TracerouteStatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceNodeId = parseNumberParam(searchParams.get('source_node'));

  const setSourceNode = (id: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id == null) {
      next.delete('source_node');
    } else {
      next.set('source_node', String(id));
    }
    setSearchParams(next, { replace: true });
  };

  const [triggerModalOpen, setTriggerModalOpen] = useState(false);

  const { triggerableNodes } = useTracerouteTriggerableNodesSuspense();
  const { managedNodes } = useManagedNodesSuspense({
    pageSize: 500,
    includeStatus: true,
    includeGeoClassification: true,
  });
  const managedByMeshId = useMemo(() => new Map(managedNodes.map((m) => [m.meshtastic_node_id, m])), [managedNodes]);
  const modalManagedNodes = useMemo(
    () =>
      triggerableNodes.map((t) => {
        const full = managedByMeshId.get(t.meshtastic_node_id);
        return full ? { ...t, ...full } : t;
      }),
    [triggerableNodes, managedByMeshId]
  );
  const canTrigger = triggerableNodes.length > 0;
  const { nodes: observedNodes } = useNodesSuspense({
    lastHeardAfter: subDays(new Date(), 7),
    pageSize: 500,
  });
  const triggerMutation = useTriggerTraceroute();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <RouteIcon className="h-6 w-6" />
          Traceroute statistics
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sourceNodeId != null ? String(sourceNodeId) : 'all'}
            onValueChange={(v) => setSourceNode(v === 'all' ? null : parseInt(v, 10))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Source (stats scope)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {triggerableNodes.map((n) => (
                <SelectItem key={n.meshtastic_node_id} value={String(n.meshtastic_node_id)}>
                  {n.short_name ?? n.node_id_str ?? String(n.meshtastic_node_id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="default" asChild>
            <Link to="/traceroutes/history">
              <ListIcon className="mr-2 h-4 w-4" />
              Traceroute history
            </Link>
          </Button>
          {canTrigger && (
            <Button size="default" onClick={() => setTriggerModalOpen(true)}>
              <RouteIcon className="mr-2 h-4 w-4" />
              Trigger traceroute
            </Button>
          )}
        </div>
      </div>

      <TracerouteStatsSection sourceNodeId={sourceNodeId} />

      <TriggerTracerouteModal
        open={triggerModalOpen}
        onOpenChange={setTriggerModalOpen}
        mode={'user' as TriggerMode}
        managedNodes={modalManagedNodes}
        observedNodes={observedNodes}
        onTrigger={async (managedNodeId, targetNodeId, targetStrategy) => {
          try {
            await triggerMutation.mutateAsync({ managedNodeId, targetNodeId, targetStrategy });
            setTriggerModalOpen(false);
          } catch (err) {
            toast.error('Traceroute failed', {
              description: getTracerouteErrorMessage(err),
            });
          }
        }}
        isSubmitting={triggerMutation.isPending}
      />
    </div>
  );
}
