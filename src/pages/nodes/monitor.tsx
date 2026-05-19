import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNodeWatches } from '@/hooks/api/useNodeWatches';
import { NodesMap } from '@/components/nodes/NodesMap';
import { WatchedNodesTable } from '@/components/nodes/WatchedNodesTable';
import { WatchDashboardSummary } from '@/components/nodes/WatchDashboardSummary';
import { MonitoredNodesBatteryChart } from '@/components/nodes/MonitoredNodesBatteryChart';
import { MonitoredNodesChannelUtilChart } from '@/components/nodes/MonitoredNodesChannelUtilChart';
import { TracerouteDetailModal } from '@/pages/traceroutes/TracerouteDetailModal';
import { TriggerTracerouteModal } from '@/pages/traceroutes/TriggerTracerouteModal';
import { getTracerouteErrorMessage } from '@/pages/traceroutes/tracerouteErrors';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { NodeWatch, ObservedNode } from '@/lib/models';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import { useTracerouteTriggerableNodes, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import {
  countWatchesByMonitoringStatus,
  deriveWatchMonitoringStatus,
  sortWatchesByMonitoringStatus,
  WATCH_STATUS_MAP_COLOR,
  watchMonitoringStatusLegendSwatches,
} from '@/lib/watch-monitoring-status';

function nodeFromWatch(watch: NodeWatch): ObservedNode {
  return watch.observed_node as unknown as ObservedNode;
}

export default function MonitorNodesPage() {
  const watchesQuery = useNodeWatches();
  const [selectedTracerouteId, setSelectedTracerouteId] = useState<number | null>(null);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<ObservedNode | null>(null);

  const watches = useMemo(() => watchesQuery.data?.results ?? [], [watchesQuery.data?.results]);
  const sortedWatches = useMemo(() => sortWatchesByMonitoringStatus(watches), [watches]);
  const watchCounts = useMemo(() => countWatchesByMonitoringStatus(watches), [watches]);
  const nodesForCharts = useMemo(() => sortedWatches.map(nodeFromWatch), [sortedWatches]);

  const markerColorsByNodeId = useMemo(() => {
    const m = new Map<number, string>();
    for (const w of sortedWatches) {
      const st = deriveWatchMonitoringStatus(w);
      m.set(w.observed_node.meshtastic_node_id, WATCH_STATUS_MAP_COLOR[st]);
    }
    return m;
  }, [sortedWatches]);

  const api = useMeshtasticApi();
  const triggerableQuery = useTracerouteTriggerableNodes();
  const triggerMutation = useTriggerTraceroute();

  const managedPages = useInfiniteQuery({
    queryKey: ['managed-nodes', 500, 'status+geo'] as const,
    queryFn: ({ pageParam = 1 }) =>
      api.getManagedNodes({
        page: pageParam as number,
        page_size: 500,
        includeStatus: true,
        includeGeoClassification: true,
      }),
    initialPageParam: 1,
    getNextPageParam: (last, allPages) => (last.next ? allPages.length + 1 : undefined),
    enabled: watches.length > 0,
  });

  useEffect(() => {
    if (managedPages.hasNextPage && !managedPages.isFetchingNextPage && !managedPages.isError) {
      void managedPages.fetchNextPage();
    }
  }, [
    managedPages.hasNextPage,
    managedPages.isFetchingNextPage,
    managedPages.isError,
    managedPages.fetchNextPage,
    managedPages,
  ]);

  const modalManagedNodes = useMemo(() => {
    const triggerable = triggerableQuery.data ?? [];
    const pages = managedPages.data?.pages.flatMap((p) => p.results) ?? [];
    const byId = new Map(pages.map((m) => [m.meshtastic_node_id, m]));
    return triggerable.map((t) => {
      const full = byId.get(t.meshtastic_node_id);
      return full ? { ...t, ...full } : t;
    });
  }, [triggerableQuery.data, managedPages.data?.pages]);

  const canTriggerTraceroute = (triggerableQuery.data?.length ?? 0) > 0;

  const scrollToWatch = (watchId: number) => {
    const el = document.getElementById(`watch-card-${watchId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (el as HTMLElement | null)?.focus({ preventScroll: true });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesh watches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          You are explicitly monitoring these nodes for mesh connectivity.
        </p>
      </div>

      {watchesQuery.isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      )}

      {watchesQuery.isError && (
        <div className="text-center py-12 rounded-lg border border-destructive/50 text-destructive">
          Could not load watches. Try again later.
        </div>
      )}

      {!watchesQuery.isLoading && !watchesQuery.isError && watches.length === 0 && (
        <div className="text-center py-12 bg-background rounded-lg border">
          <h3 className="text-lg font-medium">No watches yet</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Add a mesh monitoring watch from{' '}
            <Link to="/nodes/my-nodes" className="text-teal-600 dark:text-teal-400 hover:underline">
              My Nodes
            </Link>{' '}
            or{' '}
            <Link to="/nodes/infrastructure" className="text-teal-600 dark:text-teal-400 hover:underline">
              Mesh Infrastructure
            </Link>{' '}
            to see alerts and status here.
          </p>
        </div>
      )}

      {!watchesQuery.isLoading && !watchesQuery.isError && watches.length > 0 && (
        <>
          <WatchDashboardSummary watches={sortedWatches} counts={watchCounts} onJumpToWatch={scrollToWatch} />

          <div className="h-[400px] bg-background rounded-lg border">
            <NodesMap
              nodes={nodesForCharts}
              markerColorsByNodeId={markerColorsByNodeId}
              mapLegendStatusSwatches={watchMonitoringStatusLegendSwatches()}
              mapLegendStatusTitle="Watch status"
            />
          </div>

          <div className="bg-background rounded-lg border">
            <WatchedNodesTable
              watches={sortedWatches}
              watchesQuery={watchesQuery}
              onOpenTraceroute={setSelectedTracerouteId}
              onRequestTriggerTraceroute={(node) => {
                setTriggerTarget(node);
                setTriggerModalOpen(true);
              }}
              canTriggerTraceroute={canTriggerTraceroute}
            />
          </div>

          <Accordion type="multiple" className="bg-background rounded-lg border px-2">
            <AccordionItem value="battery" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                Battery voltage comparison
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <MonitoredNodesBatteryChart nodes={nodesForCharts} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="channel-util" className="border-0">
              <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                Channel utilization
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <MonitoredNodesChannelUtilChart nodes={nodesForCharts} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      <TracerouteDetailModal
        tracerouteId={selectedTracerouteId}
        open={selectedTracerouteId != null}
        onOpenChange={(open) => !open && setSelectedTracerouteId(null)}
      />

      <TriggerTracerouteModal
        open={triggerModalOpen}
        onOpenChange={(open) => {
          setTriggerModalOpen(open);
          if (!open) setTriggerTarget(null);
        }}
        mode="user"
        managedNodes={modalManagedNodes}
        observedNodes={triggerTarget ? [triggerTarget] : []}
        fixedTargetNode={triggerTarget ?? undefined}
        onTrigger={async (managedNodeId, targetNodeId, targetStrategy) => {
          try {
            await triggerMutation.mutateAsync({ managedNodeId, targetNodeId, targetStrategy });
            setTriggerModalOpen(false);
            setTriggerTarget(null);
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
