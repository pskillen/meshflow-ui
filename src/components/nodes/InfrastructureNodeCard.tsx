import { Link } from 'react-router-dom';
import { DeviceMetrics, ManagedNode, ObservedNode, NodeWatch, PaginatedResponse } from '@/lib/models';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { MeshWatchControls } from '@/components/nodes/MeshWatchControls';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { STRATEGY_META, type TracerouteStrategyValue } from '@/lib/traceroute-strategy';
import type { UseQueryResult } from '@tanstack/react-query';
import { getRoleLabel } from '@/lib/meshtastic';
import { Badge } from '@/components/ui/badge';
import { NodeMiniChart } from '@/components/nodes/NodeMiniChart';
import { Check, ChevronRight } from 'lucide-react';
import { useState, memo } from 'react';
import { RfPropagationMapModal } from '@/components/nodes/RfPropagationMapModal';

interface InfrastructureNodeCardProps {
  node: ObservedNode;
  /** When provided with dateRange, shows a mini battery/channel chart */
  metrics?: DeviceMetrics[];
  dateRange?: { startDate: Date; endDate: Date };
  /** When true, this node is included in the comparison charts */
  compareSelected?: boolean;
  /** Called when the compare checkbox is toggled. Receives (nodeId, newState). */
  onCompareToggle?: (nodeId: number, newState: boolean) => void;
  /** Current user's watch for this node, if any */
  watch?: NodeWatch;
  /** From useNodeWatches — loading/error for watch list */
  watchesQuery?: Pick<UseQueryResult<PaginatedResponse<NodeWatch>>, 'isLoading' | 'isError'>;
  /** When this infrastructure node is a managed feeder, geo classification from the API */
  managedNode?: ManagedNode | null;
}

function InfrastructureNodeCardInner({
  node,
  metrics,
  dateRange,
  onCompareToggle,
  watch,
  watchesQuery,
  managedNode,
}: InfrastructureNodeCardProps) {
  const roleLabel = getRoleLabel(node.meshtastic_role);
  const [compareSelected, setCompareSelected] = useState(false);
  const [propagationMapOpen, setPropagationMapOpen] = useState(false);

  return (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{node.short_name}</h2>
          <p className="text-slate-600 dark:text-slate-400">{node.long_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {onCompareToggle != null && (
            <button
              type="button"
              tabIndex={0}
              role="checkbox"
              aria-checked={compareSelected}
              aria-label={`Compare ${node.short_name || node.node_id_str}`}
              className="flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 text-left text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              onClick={(e) => {
                e.preventDefault();
                const newState = !compareSelected;
                setCompareSelected(newState);
                onCompareToggle?.(node.meshtastic_node_id, newState);
              }}
            >
              <span
                className={`h-4 w-4 shrink-0 rounded-sm border border-primary shadow flex items-center justify-center ${
                  compareSelected ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                {compareSelected && <Check className="h-2.5 w-2.5" />}
              </span>
              Compare
            </button>
          )}
          {roleLabel && (
            <Badge variant="secondary" className="text-xs">
              {roleLabel}
            </Badge>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">
            <StaleReportedTime at={node.last_heard ?? null} fallback="Never" className="text-inherit" />
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-slate-600 dark:text-slate-400">ID: {node.node_id_str}</p>
        {managedNode?.geo_classification && (
          <div className="flex flex-wrap gap-1.5 py-1" data-testid="infra-feeder-geo">
            <Badge variant="outline" className="text-xs font-normal">
              {managedNode.geo_classification.tier === 'perimeter'
                ? `Perimeter${
                    managedNode.geo_classification.bearing_octant
                      ? ` (${managedNode.geo_classification.bearing_octant})`
                      : ''
                  }`
                : 'Internal feeder'}
            </Badge>
            <TooltipProvider delayDuration={200}>
              {managedNode.geo_classification.applicable_strategies.map((s) => (
                <Tooltip key={s}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs cursor-help font-normal">
                      {STRATEGY_META[s as TracerouteStrategyValue]?.label ?? s}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {STRATEGY_META[s as TracerouteStrategyValue]?.shortDescription ?? s}
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        )}
        {node.owner && <p className="text-slate-600 dark:text-slate-400">Owner: {node.owner.username}</p>}
        {node.latest_device_metrics && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span>
              Battery:{' '}
              {node.latest_device_metrics.battery_level != null ? `${node.latest_device_metrics.battery_level}%` : '—'}
            </span>
            <span>
              Ch. util:{' '}
              {node.latest_device_metrics.channel_utilization != null
                ? `${node.latest_device_metrics.channel_utilization.toFixed(1)}%`
                : '—'}
            </span>
            <span>
              Uptime:{' '}
              {node.latest_device_metrics.uptime_seconds != null
                ? `${Math.round(node.latest_device_metrics.uptime_seconds / 3600)}h`
                : '—'}
            </span>
          </div>
        )}
        {metrics != null && metrics.length > 0 && dateRange && (
          <div className="mt-3 -mx-2">
            <NodeMiniChart metrics={metrics} dateRange={dateRange} />
          </div>
        )}
        {watchesQuery != null && (
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
            <p className="text-xs font-medium text-muted-foreground mb-2">Mesh monitoring</p>
            <MeshWatchControls
              node={node}
              watch={watch}
              watchesQuery={watchesQuery}
              idPrefix={`infra-card-${node.meshtastic_node_id}`}
              compact
            />
          </div>
        )}
      </div>
      <div className="mt-auto flex justify-end gap-3 pt-3">
        {managedNode != null && (
          <Link
            to={`/traceroutes/map/coverage?feeder=${node.meshtastic_node_id}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            data-testid={`infra-coverage-link-${node.meshtastic_node_id}`}
          >
            Coverage map
          </Link>
        )}
        {node.has_ready_rf_render === true && (
          <>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              data-testid={`infra-propagation-map-${node.meshtastic_node_id}`}
              onClick={() => setPropagationMapOpen(true)}
            >
              Propagation map
            </button>
            <RfPropagationMapModal
              open={propagationMapOpen}
              onOpenChange={setPropagationMapOpen}
              nodeId={node.meshtastic_node_id}
              shortLabel={node.short_name}
            />
          </>
        )}
        <Link
          to={`/nodes/${node.meshtastic_node_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open node details
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export const InfrastructureNodeCard = memo(InfrastructureNodeCardInner);
