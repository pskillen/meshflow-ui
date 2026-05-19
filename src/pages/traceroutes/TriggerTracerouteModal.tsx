import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NodeSearch } from '@/components/NodeSearch';
import { NodesAndConstellationsMap, MapNode } from '@/components/nodes/NodesAndConstellationsMap';
import { AutoTargetPreviewMap } from '@/components/traceroutes/AutoTargetPreviewMap';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ManagedNode, ObservedNode } from '@/lib/models';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { observedNodeHeardOnOrAfter, pickTargetLastHeardCutoff } from '@/lib/observed-node-recency';
import type { TargetPreviewStrategy } from '@/lib/tracerouteTargetGeometry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
export type ManualTargetStrategyChoice = 'auto' | 'intra_zone' | 'dx_across' | 'dx_same_side';

export type TriggerMode = 'user' | 'auto';

interface TriggerTracerouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial mode when the dialog opens. The user can switch modes inside the dialog when no fixedTargetNode is set. */
  mode: TriggerMode;
  managedNodes: ManagedNode[];
  observedNodes: ObservedNode[];
  onTrigger: (
    managedNodeId: number,
    targetNodeId?: number,
    targetStrategy?: 'intra_zone' | 'dx_across' | 'dx_same_side'
  ) => Promise<void>;
  isSubmitting: boolean;
  /**
   * When set, the dialog is locked to user mode with the target fixed to this
   * ObservedNode. The picker/map is hidden, the mode toggle is hidden, and the
   * target row is read-only.
   */
  fixedTargetNode?: ObservedNode;
}

function formatNodeLabel(node: { short_name: string | null; node_id_str: string }): string {
  return `${node.short_name ?? node.node_id_str} (${node.node_id_str})`;
}

export function TriggerTracerouteModal({
  open,
  onOpenChange,
  mode: initialMode,
  managedNodes,
  observedNodes,
  onTrigger,
  isSubmitting,
  fixedTargetNode,
}: TriggerTracerouteModalProps) {
  const [mode, setMode] = useState<TriggerMode>(initialMode);
  const [managedNodeId, setManagedNodeId] = useState<number | null>(null);
  const [targetNodeId, setTargetNodeId] = useState<number | null>(null);
  const [targetNodeLabel, setTargetNodeLabel] = useState<string | null>(null);
  const [strategyChoice, setStrategyChoice] = useState<ManualTargetStrategyChoice>('auto');
  const [halfWindowDeg, setHalfWindowDeg] = useState(45);

  const hasFixedTarget = fixedTargetNode != null;

  // Reset mode when the dialog reopens or the initial mode prop changes.
  useEffect(() => {
    if (!open) return;
    setMode(hasFixedTarget ? 'user' : initialMode);
    setStrategyChoice('auto');
    setHalfWindowDeg(45);
  }, [open, initialMode, hasFixedTarget]);

  useEffect(() => {
    if (!hasFixedTarget || !fixedTargetNode) return;
    setTargetNodeId(fixedTargetNode.meshtastic_node_id);
    setTargetNodeLabel(formatNodeLabel(fixedTargetNode));
  }, [hasFixedTarget, fixedTargetNode]);

  const selectedManaged = managedNodes.find((m) => m.meshtastic_node_id === managedNodeId);
  const geo = selectedManaged?.geo_classification;
  const canIntraZone = geo?.applicable_strategies?.includes('intra_zone') ?? false;

  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  const managedNodeIdSet = useMemo(
    () => new Set(managedNodesForMap.map((m) => m.meshtastic_node_id)),
    [managedNodesForMap]
  );

  const [pickTargetLastHeardAfter, setPickTargetLastHeardAfter] = useState(() => pickTargetLastHeardCutoff());

  useEffect(() => {
    if (!open) return;
    setPickTargetLastHeardAfter(pickTargetLastHeardCutoff());
  }, [open]);

  const pickTargetObservedNodes = useMemo(
    () => observedNodes.filter((n) => observedNodeHeardOnOrAfter(n, pickTargetLastHeardAfter)),
    [observedNodes, pickTargetLastHeardAfter]
  );

  const previewStrategy: TargetPreviewStrategy =
    strategyChoice === 'auto' ? 'auto' : strategyChoice === 'intra_zone' && !canIntraZone ? 'auto' : strategyChoice;

  /** Omit for manual target (API stores `manual`) or auto + "pick automatically" (API resolves strategy). */
  const strategyForApi: 'intra_zone' | 'dx_across' | 'dx_same_side' | undefined =
    mode === 'user'
      ? undefined
      : strategyChoice === 'auto'
        ? undefined
        : strategyChoice === 'intra_zone' && !canIntraZone
          ? undefined
          : strategyChoice;

  const handleSubmit = async () => {
    if (!managedNodeId) return;
    if (mode === 'user' && !targetNodeId) return;
    await onTrigger(managedNodeId, mode === 'user' ? (targetNodeId ?? undefined) : undefined, strategyForApi);
    setManagedNodeId(null);
    if (!hasFixedTarget) {
      setTargetNodeId(null);
      setTargetNodeLabel(null);
    }
  };

  const canSubmit =
    managedNodeId != null &&
    (mode === 'auto' || targetNodeId != null) &&
    !(mode === 'auto' && strategyChoice === 'intra_zone' && !canIntraZone);

  const handleMapNodeSelect = (node: MapNode | null) => {
    if (!node) {
      setTargetNodeId(null);
      setTargetNodeLabel(null);
      return false;
    }
    setTargetNodeId(node.meshtastic_node_id);
    setTargetNodeLabel(`${node.short_name ?? node.node_id_str} (${node.node_id_str})`);
    return true;
  };

  // In the fixed-target variant, clicking a managed marker picks it as source.
  // Clicking anything else (e.g. the fixed target itself) is a no-op.
  const handleFixedTargetMapNodeSelect = (node: MapNode | null) => {
    if (!node) return false;
    const isManaged = managedNodesForMap.some((m) => m.meshtastic_node_id === node.meshtastic_node_id);
    if (!isManaged) return false;
    setManagedNodeId(node.meshtastic_node_id);
    return true;
  };

  const dialogDescription =
    mode === 'auto'
      ? 'Select the source node. The target will be auto-selected (most recently heard).'
      : hasFixedTarget
        ? 'Select the source node. The target is fixed to the node you are viewing.'
        : 'Select the source node and target node for the traceroute.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={!hasFixedTarget ? 'max-w-4xl' : undefined}>
        <DialogHeader>
          <DialogTitle>Trigger Traceroute</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {!hasFixedTarget && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as TriggerMode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">Pick target</TabsTrigger>
              <TabsTrigger value="auto">Auto target</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="managed-node">Source node</Label>
            <Select
              value={managedNodeId?.toString() ?? ''}
              onValueChange={(v) => setManagedNodeId(v ? parseInt(v, 10) : null)}
            >
              <SelectTrigger id="managed-node">
                <SelectValue placeholder="Select source node..." />
              </SelectTrigger>
              <SelectContent>
                {managedNodes.map((node) => (
                  <SelectItem key={node.meshtastic_node_id} value={node.meshtastic_node_id.toString()}>
                    {node.short_name ?? node.node_id_str} ({node.node_id_str})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'auto' && (
            <>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="tr-strategy">Target strategy</Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Strategy help"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs text-xs">
                        Chooses how the API picks a target when you do not pick one manually. Intra-zone needs a
                        constellation envelope (enough positioned managed nodes).
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={strategyChoice}
                  onValueChange={(v) => setStrategyChoice(v as ManualTargetStrategyChoice)}
                >
                  <SelectTrigger id="tr-strategy" data-testid="trigger-traceroute-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Pick automatically</SelectItem>
                    <SelectItem value="intra_zone" disabled={!canIntraZone}>
                      Intra-zone
                    </SelectItem>
                    <SelectItem value="dx_across">DX across</SelectItem>
                    <SelectItem value="dx_same_side">DX same side</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {mode === 'auto' && !hasFixedTarget && managedNodeId != null && selectedManaged && (
            <div className="grid gap-2">
              <Label>DX half-window (bearing ±°)</Label>
              <ToggleGroup
                type="single"
                value={String(halfWindowDeg)}
                onValueChange={(v) => {
                  if (v) setHalfWindowDeg(parseInt(v, 10));
                }}
                variant="outline"
                size="sm"
                className="w-fit flex-wrap"
              >
                {[45, 60, 75, 90].map((d) => (
                  <ToggleGroupItem key={d} value={String(d)} className="text-xs">
                    {d}°
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                Shaded regions approximate API target pools (client-side). Hollow dots are excluded for the selected
                strategy.
              </p>
              <AutoTargetPreviewMap
                feeder={selectedManaged}
                candidates={observedNodes}
                managedNodeIds={managedNodeIdSet}
                strategy={previewStrategy}
                halfWindowDeg={halfWindowDeg}
              />
            </div>
          )}

          {mode === 'user' && hasFixedTarget && fixedTargetNode && (
            <>
              <div className="grid gap-2">
                <Label>Target node</Label>
                <div
                  className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
                  data-testid="trigger-traceroute-fixed-target"
                >
                  {formatNodeLabel(fixedTargetNode)}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Pick a source on the map</Label>
                <p className="text-xs text-muted-foreground">
                  Target is highlighted. Click an available source to select it.
                </p>
                <div className="h-[300px] rounded-md border overflow-hidden">
                  <NodesAndConstellationsMap
                    managedNodes={managedNodesForMap}
                    observedNodes={[fixedTargetNode]}
                    showConstellation={true}
                    showUnmanagedNodes={true}
                    drawBoundingBox={false}
                    enableBubbles={false}
                    selectedNodeId={managedNodeId ?? fixedTargetNode.meshtastic_node_id}
                    onNodeSelect={handleFixedTargetMapNodeSelect}
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'user' && !hasFixedTarget && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="target-node">Target node</Label>
                <NodeSearch
                  lastHeardAfter={pickTargetLastHeardAfter}
                  onNodeSelect={(id, node) => {
                    setTargetNodeId(id);
                    setTargetNodeLabel(node ? `${node.short_name ?? node.node_id_str} (${node.node_id_str})` : null);
                  }}
                  displayValue={targetNodeId ? (targetNodeLabel ?? undefined) : null}
                  onClearSelection={() => {
                    setTargetNodeId(null);
                    setTargetNodeLabel(null);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Or click on the map</Label>
                <p className="text-xs text-muted-foreground">
                  Only nodes heard in the last 48 hours are listed and shown on the map.
                </p>
                <div className="h-[300px] rounded-md border overflow-hidden">
                  <NodesAndConstellationsMap
                    managedNodes={managedNodesForMap}
                    observedNodes={pickTargetObservedNodes}
                    showConstellation={true}
                    showUnmanagedNodes={true}
                    drawBoundingBox={false}
                    enableBubbles={false}
                    selectedNodeId={targetNodeId}
                    onNodeSelect={handleMapNodeSelect}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Triggering...' : 'Trigger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
