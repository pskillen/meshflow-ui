import { useProtocolObservedNodesSuspense } from '@/hooks/api/useProtocolNodes';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshCoreManagedNodesSuspense } from '@/hooks/api/useMeshCore';
import { useMemo, useState } from 'react';
import { NodeCard } from '@/components/nodes/NodeCard';
import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { NodesMap } from '@/components/nodes/NodesMap';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ObservedNode } from '@/lib/models';
import { Link } from 'react-router-dom';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { buildMeshCoreMapNodes } from '@/lib/meshcore-map-nodes';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { NODE_TIME_RANGE_OPTIONS, getLastHeardAfterForRange, type NodeTimeRangeOption } from '@/lib/node-time-range';
import { formatDistanceToNow } from 'date-fns';

type SortOption = 'last_heard' | 'name';

function IdentityOnlyTable({ nodes, config }: { nodes: ObservedNode[]; config: ProtocolPageConfig }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity only / no position ({nodes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Last heard</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No nodes in this section yet.
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((node) => (
                <TableRow key={String(node.internal_id)}>
                  <TableCell className="font-mono text-xs">
                    <Link to={config.routes.nodeDetail(node.internal_id)} className="text-primary hover:underline">
                      {node.node_id_str}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {node.long_name || '—'} / {node.short_name || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{node.mc_pubkey_prefix || '—'}</TableCell>
                  <TableCell>
                    {node.last_heard ? formatDistanceToNow(node.last_heard, { addSuffix: true }) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type ProtocolNodesPageProps = {
  config: ProtocolPageConfig;
};

function ProtocolNodesPageContent({
  config,
  managedNodesForMap,
}: ProtocolNodesPageProps & { managedNodesForMap: ReturnType<typeof filterManagedNodesForMapDisplay> }) {
  const [timeRange, setTimeRange] = useState<NodeTimeRangeOption>('7d');
  const [sortBy, setSortBy] = useState<SortOption>('last_heard');
  const [searchQuery, setSearchQuery] = useState('');

  const lastHeardAfter = useMemo(() => getLastHeardAfterForRange(timeRange), [timeRange]);

  const {
    nodes: mainListNodes,
    totalNodes,
    fetchNextPage,
    hasNextPage,
  } = useProtocolObservedNodesSuspense(config, {
    lastHeardAfter,
    pageSize: 100,
  });

  const sortNodes = (nodes: ObservedNode[]) => {
    return [...nodes].sort((a, b) => {
      if (sortBy === 'last_heard') {
        if (!a.last_heard) return 1;
        if (!b.last_heard) return -1;
        return b.last_heard.getTime() - a.last_heard.getTime();
      }
      const aName = a.long_name || '';
      const bName = b.long_name || '';
      return aName.localeCompare(bName);
    });
  };

  const filterNodes = (nodes: ObservedNode[]) => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (node) =>
        node.long_name?.toLowerCase().includes(query) ||
        node.short_name?.toLowerCase().includes(query) ||
        node.node_id_str?.toLowerCase().includes(query) ||
        node.mc_pubkey_prefix?.toLowerCase().includes(query)
    );
  };

  const displayedNodes = sortNodes(filterNodes(mainListNodes || []));
  const observedForMap = searchQuery ? filterNodes(mainListNodes || []) : mainListNodes || [];
  const mapNodes = useMemo(() => {
    if (config.slug !== 'meshcore') {
      return observedForMap;
    }
    return buildMeshCoreMapNodes(observedForMap, managedNodesForMap);
  }, [config.slug, observedForMap, managedNodesForMap]);
  const mapNodesWithPosition = useMemo(
    () => mapNodes.filter((n) => n.latest_position?.latitude != null && n.latest_position?.longitude != null),
    [mapNodes]
  );

  const { withLocation, identityOnly } = useMemo(() => {
    if (config.slug === 'meshtastic') {
      return { withLocation: displayedNodes, identityOnly: [] as ObservedNode[] };
    }
    const withLoc: ObservedNode[] = [];
    const noLoc: ObservedNode[] = [];
    for (const n of displayedNodes) {
      if (n.latest_position?.latitude != null && n.latest_position?.longitude != null) {
        withLoc.push(n);
      } else {
        noLoc.push(n);
      }
    }
    return { withLocation: withLoc, identityOnly: noLoc };
  }, [displayedNodes, config.slug]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{config.labels.nodesTitle}</h1>
          {config.slug === 'meshcore' && (
            <p className="text-sm text-muted-foreground mt-1">
              Observed MeshCore nodes (separate from the Meshtastic node list).
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="time-range" className="text-sm text-muted-foreground">
              Time range:
            </label>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as NodeTimeRangeOption)}>
              <SelectTrigger className="w-[180px]" id="time-range" aria-label="Select time range">
                <SelectValue placeholder="Select time range" />
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
            <label className="text-sm text-muted-foreground">Sort by:</label>
            <ToggleGroup
              type="single"
              value={sortBy}
              onValueChange={(value) => value && setSortBy(value as SortOption)}
            >
              <ToggleGroupItem value="last_heard" aria-label="Sort by last heard">
                Last Heard
              </ToggleGroupItem>
              <ToggleGroupItem value="name" aria-label="Sort by name">
                Name
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search nodes by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{config.slug === 'meshtastic' ? 'Mesh Nodes and Monitoring' : 'Map'}</CardTitle>
        </CardHeader>
        <CardContent>
          {config.slug === 'meshcore' && mapNodesWithPosition.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              No MeshCore nodes with a known position in this time range. Managed feeders need a default location in the
              API; observed nodes appear after ADVERT packets with coordinates.
            </p>
          ) : null}
          <div className="h-[600px] w-full">
            {config.features.constellationsOnMap ? (
              <NodesAndConstellationsMap
                managedNodes={managedNodesForMap}
                observedNodes={mapNodes}
                showConstellation={true}
                showUnmanagedNodes={true}
              />
            ) : (
              <NodesMap nodes={mapNodesWithPosition} roleLegend={config.features.roleLegend} />
            )}
          </div>
        </CardContent>
      </Card>

      {config.slug === 'meshtastic' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Recent Nodes ({displayedNodes.length}
              {totalNodes > displayedNodes.length ? ` of ${totalNodes}` : ''})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedNodes.map((node) => (
              <NodeCard key={node.internal_id} node={node} />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>With location ({withLocation.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {withLocation.map((node) => (
                  <NodeCard key={node.internal_id} node={node} />
                ))}
              </div>
              {withLocation.length === 0 && (
                <p className="text-sm text-muted-foreground">No nodes with a known position in this range.</p>
              )}
            </CardContent>
          </Card>
          <IdentityOnlyTable nodes={identityOnly} config={config} />
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => fetchNextPage()}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeshtasticProtocolNodesPage({ config }: ProtocolNodesPageProps) {
  const { managedNodes } = useManagedNodesSuspense({ pageSize: 500, includeStatus: true });
  const managedNodesForMap = useMemo(
    () => filterManagedNodesForMapDisplay(managedNodes.filter((n) => n.protocol === 1 || n.protocol == null)),
    [managedNodes]
  );
  return <ProtocolNodesPageContent config={config} managedNodesForMap={managedNodesForMap} />;
}

function MeshCoreProtocolNodesPage({ config }: ProtocolNodesPageProps) {
  const { feeders } = useMeshCoreManagedNodesSuspense({ pageSize: 500 });
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(feeders), [feeders]);
  return <ProtocolNodesPageContent config={config} managedNodesForMap={managedNodesForMap} />;
}

export function ProtocolNodesPage({ config }: ProtocolNodesPageProps) {
  if (config.slug === 'meshcore') {
    return <MeshCoreProtocolNodesPage config={config} />;
  }
  return <MeshtasticProtocolNodesPage config={config} />;
}
