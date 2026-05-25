import { Link } from 'react-router-dom';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { Badge } from '@/components/ui/badge';
import { AutoTraceRoute, TracerouteRouteNode } from '@/lib/models';
import { ArrowRight } from 'lucide-react';

const UNKNOWN_NODE_ID = 0xffffffff;

function FlowEndpointBadge({
  label,
  nodeId,
  directionColor,
}: {
  label: string;
  nodeId: number;
  directionColor: string;
}) {
  return (
    <Link
      to={nodeDetailPath({ meshtastic_node_id: nodeId, protocol: 1 }) ?? '#'}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <Badge className={`max-w-full cursor-pointer ${directionColor}`}>{label}</Badge>
    </Link>
  );
}

function NodeBadge({ node }: { node: TracerouteRouteNode }) {
  const isPlaceholderUnknown = node.meshtastic_node_id === UNKNOWN_NODE_ID;
  const useMutedStyle = isPlaceholderUnknown || !node.position;
  const label = node.short_name ?? node.node_id_str;
  const badge = (
    <Badge
      variant={useMutedStyle ? 'outline' : 'secondary'}
      className={
        useMutedStyle
          ? 'max-w-full border-dashed font-mono text-muted-foreground ' +
            (isPlaceholderUnknown ? 'cursor-default' : 'cursor-pointer')
          : 'max-w-full cursor-pointer'
      }
    >
      {label}
      {node.snr != null && !isPlaceholderUnknown && <span className="ml-1 text-xs opacity-75">({node.snr})</span>}
    </Badge>
  );

  if (isPlaceholderUnknown) {
    return badge;
  }

  return (
    <Link
      to={
        nodeDetailPath({ meshtastic_node_id: node.meshtastic_node_id, node_id_str: node.node_id_str, protocol: 1 }) ??
        '#'
      }
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      {badge}
    </Link>
  );
}

function FlowRow({
  startLabel,
  startNodeId,
  nodes,
  endLabel,
  endNodeId,
  directionColor,
}: {
  startLabel: string;
  startNodeId: number;
  nodes: TracerouteRouteNode[];
  endLabel: string;
  endNodeId: number;
  directionColor: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FlowEndpointBadge label={startLabel} nodeId={startNodeId} directionColor={directionColor} />
      {nodes.map((node, i) => (
        <span key={`${node.meshtastic_node_id}-${i}`} className="flex items-center gap-1">
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <NodeBadge node={node} />
        </span>
      ))}
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      <FlowEndpointBadge label={endLabel} nodeId={endNodeId} directionColor={directionColor} />
    </div>
  );
}

export function TracerouteFlowDiagram({ traceroute }: { traceroute: AutoTraceRoute }) {
  const routeNodes = traceroute.route_nodes ?? [];
  const routeBackNodes = traceroute.route_back_nodes ?? [];
  const sourceLabel = traceroute.source_node?.short_name ?? traceroute.source_node?.node_id_str ?? 'Source';
  const targetLabel = traceroute.target_node?.short_name ?? traceroute.target_node?.node_id_str ?? 'Target';
  const sourceNodeId = traceroute.source_node.meshtastic_node_id;
  const targetNodeId = traceroute.target_node.meshtastic_node_id;

  if (routeNodes.length === 0 && routeBackNodes.length === 0) {
    if (traceroute.status !== 'completed') {
      return null;
    }
    return (
      <div className="space-y-2 rounded-md border border-blue-500/25 bg-blue-500/5 px-3 py-3 dark:border-blue-400/30 dark:bg-blue-950/40">
        <p className="text-sm text-muted-foreground">No intermediate relays — direct RF path.</p>
        <div className="flex flex-wrap items-center gap-2">
          <FlowEndpointBadge
            label={sourceLabel}
            nodeId={sourceNodeId}
            directionColor="bg-blue-500/20 text-blue-700 dark:text-blue-300"
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <FlowEndpointBadge
            label={targetLabel}
            nodeId={targetNodeId}
            directionColor="bg-green-500/20 text-green-700 dark:text-green-300"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">Outbound</h4>
        <FlowRow
          startLabel={sourceLabel}
          startNodeId={sourceNodeId}
          nodes={routeNodes}
          endLabel={targetLabel}
          endNodeId={targetNodeId}
          directionColor="bg-blue-500/20 text-blue-700 dark:text-blue-300"
        />
      </div>
      {routeBackNodes.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Return</h4>
          <FlowRow
            startLabel={targetLabel}
            startNodeId={targetNodeId}
            nodes={routeBackNodes}
            endLabel={sourceLabel}
            endNodeId={sourceNodeId}
            directionColor="bg-green-500/20 text-green-700 dark:text-green-300"
          />
        </div>
      )}
    </div>
  );
}
