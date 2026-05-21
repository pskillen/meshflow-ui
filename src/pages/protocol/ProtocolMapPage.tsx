import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NodesAndConstellationsMap, MapNode } from '@/components/nodes/NodesAndConstellationsMap';
import { NodesMap } from '@/components/nodes/NodesMap';
import { NodeDetailSheet } from '@/components/nodes/NodeDetailSheet';
import { useProtocolObservedNodesSuspense } from '@/hooks/api/useProtocolNodes';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshCoreManagedNodesSuspense } from '@/hooks/api/useMeshCore';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { NODE_TIME_RANGE_OPTIONS, getLastHeardAfterForRange, type NodeTimeRangeOption } from '@/lib/node-time-range';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMemo, useState } from 'react';
import type { ManagedNode } from '@/lib/models';

type ProtocolMapPageProps = {
  config: ProtocolPageConfig;
};

function MeshtasticMapContent({ config }: ProtocolMapPageProps) {
  const [timeRange, setTimeRange] = useState<NodeTimeRangeOption>('7d');
  const [showConstellation, setShowConstellation] = useState(true);
  const [showUnmanagedNodes, setShowUnmanagedNodes] = useState(true);
  const [drawBoundingBox, setDrawBoundingBox] = useState(true);
  const [drawPositionUncertainty, setDrawPositionUncertainty] = useState(true);
  const [enableBubbles, setEnableBubbles] = useState(true);
  const [constellationNodeRadiusKm, setConstellationNodeRadiusKm] = useState(5);
  const [constellationBoundaryRadiusKm, setConstellationBoundaryRadiusKm] = useState(2.5);
  const [filterConstellationIds, setFilterConstellationIds] = useState<number[] | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [allowSelectNode, setAllowSelectNode] = useState(true);

  const lastHeardAfter = useMemo(() => getLastHeardAfterForRange(timeRange), [timeRange]);
  const { managedNodes: allManaged } = useManagedNodesSuspense({ pageSize: 500, includeStatus: true });
  const managedNodes = useMemo(() => allManaged.filter((n) => n.protocol === 1 || n.protocol == null), [allManaged]);
  const { nodes: observedNodes } = useProtocolObservedNodesSuspense(config, {
    lastHeardAfter,
    pageSize: 500,
  });

  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  const constellations = useMemo(() => {
    const seen = new Map<number, string>();
    managedNodes.forEach((n) => {
      if (n.constellation && !seen.has(n.constellation.id)) {
        seen.set(n.constellation.id, n.constellation.name || `Constellation ${n.constellation.id}`);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [managedNodes]);

  const constellationIds = useMemo(() => constellations.map((c) => c.id), [constellations]);

  const toggleConstellationFilter = (id: number) => {
    setFilterConstellationIds((prev) => {
      if (prev == null) {
        return constellationIds.filter((x) => x !== id);
      }
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next.length === constellationIds.length ? null : next;
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{config.labels.mapTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6 items-start">
            <div className="flex items-center gap-2">
              <Label htmlFor="time-range" className="text-sm text-muted-foreground whitespace-nowrap">
                Time range:
              </Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as NodeTimeRangeOption)}>
                <SelectTrigger className="w-[140px]" id="time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TIME_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-constellation" checked={showConstellation} onCheckedChange={setShowConstellation} />
              <Label htmlFor="show-constellation" className="text-sm">
                Show constellation
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-unmanaged" checked={showUnmanagedNodes} onCheckedChange={setShowUnmanagedNodes} />
              <Label htmlFor="show-unmanaged" className="text-sm">
                Show unmanaged nodes
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="draw-bbox" checked={drawBoundingBox} onCheckedChange={setDrawBoundingBox} />
              <Label htmlFor="draw-bbox" className="text-sm">
                Draw bounding box
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="draw-uncertainty"
                checked={drawPositionUncertainty}
                onCheckedChange={setDrawPositionUncertainty}
              />
              <Label htmlFor="draw-uncertainty" className="text-sm">
                Draw position uncertainty
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="enable-bubbles" checked={enableBubbles} onCheckedChange={setEnableBubbles} />
              <Label htmlFor="enable-bubbles" className="text-sm">
                Enable popups
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="allow-select-node" checked={allowSelectNode} onCheckedChange={setAllowSelectNode} />
              <Label htmlFor="allow-select-node" className="text-sm">
                Allow select node
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="node-radius" className="text-sm text-muted-foreground whitespace-nowrap">
                Node radius (km):
              </Label>
              <Input
                id="node-radius"
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={constellationNodeRadiusKm}
                onChange={(e) => setConstellationNodeRadiusKm(parseFloat(e.target.value) || 2)}
                className="w-20"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="boundary-radius" className="text-sm text-muted-foreground whitespace-nowrap">
                Boundary radius (km):
              </Label>
              <Input
                id="boundary-radius"
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={constellationBoundaryRadiusKm}
                onChange={(e) => setConstellationBoundaryRadiusKm(parseFloat(e.target.value) || 2.5)}
                className="w-20"
              />
            </div>
          </div>

          {constellations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Filter constellations:</Label>
              <div className="flex flex-wrap gap-2">
                {constellations.map(({ id, name }) => (
                  <label key={id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterConstellationIds == null || filterConstellationIds.includes(id)}
                      onChange={() => toggleConstellationFilter(id)}
                      className="rounded"
                    />
                    <span className="text-sm">{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedNode && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedNode.long_name || selectedNode.node_id_str}{' '}
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-teal-600 dark:text-teal-400 hover:underline ml-1"
              >
                (clear)
              </button>
            </div>
          )}

          <NodeDetailSheet
            internalId={
              selectedNode && 'internal_id' in selectedNode && typeof selectedNode.internal_id === 'string'
                ? selectedNode.internal_id
                : null
            }
            open={selectedNode != null}
            onOpenChange={(open) => !open && setSelectedNode(null)}
          />

          <div className="h-[500px] w-full rounded-md overflow-hidden">
            <NodesAndConstellationsMap
              managedNodes={managedNodesForMap}
              observedNodes={observedNodes}
              showConstellation={showConstellation}
              showUnmanagedNodes={showUnmanagedNodes}
              drawBoundingBox={drawBoundingBox}
              constellationNodeRadiusKm={constellationNodeRadiusKm}
              constellationBoundaryRadiusKm={constellationBoundaryRadiusKm}
              drawPositionUncertainty={drawPositionUncertainty}
              filterConstellationIds={filterConstellationIds}
              enableBubbles={enableBubbles}
              onNodeSelect={(node) => {
                setSelectedNode(node);
                return allowSelectNode;
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MeshCoreMapContent({ config }: ProtocolMapPageProps) {
  const [timeRange, setTimeRange] = useState<NodeTimeRangeOption>('30d');
  const lastHeardAfter = useMemo(() => getLastHeardAfterForRange(timeRange), [timeRange]);
  const { nodes } = useProtocolObservedNodesSuspense(config, { pageSize: 500, lastHeardAfter });
  const { feeders } = useMeshCoreManagedNodesSuspense({ pageSize: 200 });

  const nodesWithPosition = useMemo(
    () => nodes.filter((n) => n.latest_position?.latitude != null && n.latest_position?.longitude != null),
    [nodes]
  );

  const feedersWithPosition = feeders.filter(
    (f) => f.position?.latitude != null && f.position?.longitude != null
  ) as ManagedNode[];

  return (
    <div className="space-y-4 container mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>{config.labels.mapTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="mc-time-range" className="text-sm text-muted-foreground">
              Time range:
            </Label>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as NodeTimeRangeOption)}>
              <SelectTrigger className="w-[140px]" id="mc-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODE_TIME_RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Observed MeshCore nodes with a known position (from ADVERT). Feeders with a default location are listed
            below.
          </p>
          <div className="h-[480px] w-full">
            <NodesMap nodes={nodesWithPosition} showMapLegend roleLegend={config.features.roleLegend} />
          </div>
          {feedersWithPosition.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Feeders (default location)</h3>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {feedersWithPosition.map((f) => (
                  <li key={f.meshtastic_node_id}>
                    {f.long_name || f.node_id_str} — {f.position.latitude?.toFixed(4)},{' '}
                    {f.position.longitude?.toFixed(4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ProtocolMapPage({ config }: ProtocolMapPageProps) {
  if (config.features.constellationsOnMap) {
    return <MeshtasticMapContent config={config} />;
  }
  return <MeshCoreMapContent config={config} />;
}
