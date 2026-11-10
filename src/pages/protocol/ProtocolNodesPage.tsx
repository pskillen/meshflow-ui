import { useProtocolObservedNodesSuspense } from '@/hooks/api/useProtocolNodes';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshCoreManagedNodesSuspense } from '@/hooks/api/useMeshCore';
import { useMemo, useState } from 'react';
import { NodeCard } from '@/components/nodes/NodeCard';
import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { NodesMap } from '@/components/nodes/NodesMap';
import { StatsRangeBar } from '@/components/stats/StatsRangeBar';
import { useStatsRange } from '@/hooks/useStatsRange';
import { STATS_ONLINE_KEY, STATS_PRESET_KEYS } from '@/lib/stats-range';
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
import { formatDistanceToNow } from 'date-fns';

type SortOption = 'last_heard' | 'name';

/** Node lists offer Online (2h) on top of the shared presets. Module-level so the hook sees a stable array. */
const NODE_LIST_RANGE_OPTIONS = [STATS_ONLINE_KEY, ...STATS_PRESET_KEYS] as const;

/** A short map on phones so the list starts in the first screen; the desktop default is unchanged. */
const MAP_MIN_HEIGHT = 'min-h-[260px] sm:min-h-[400px]';

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
  const range = useStatsRange({ area: 'node-lists', options: NODE_LIST_RANGE_OPTIONS });
  const [sortBy, setSortBy] = useState<SortOption>('last_heard');
  const [searchQuery, setSearchQuery] = useState('');

  const lastHeardAfter = range.window.start;

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

  // The one place the count is shown. ui#419 adds a separate "Showing the first X of Y" notice for the server cap.
  const countLine = (
    <p className="text-sm tabular-nums text-muted-foreground" data-testid="nodes-count">
      Showing {displayedNodes.length} of {totalNodes} nodes heard in {range.longLabel}
    </p>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">{config.labels.nodesTitle}</h1>
        {config.slug === 'meshcore' && (
          <p className="text-sm text-muted-foreground mt-1">
            Observed MeshCore nodes (separate from the Meshtastic node list).
          </p>
        )}
      </div>

      {/* One sticky wrapper for the range bar and the search row: no offset to keep in step with the bar's height. */}
      <div
        className="sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/95 px-4 backdrop-blur"
        data-testid="nodes-chrome"
      >
        <StatsRangeBar
          value={range.key}
          options={range.options}
          onChange={range.setRange}
          sticky={false}
          className="border-b-0 py-1.5"
        />
        <div className="flex items-center gap-2 pb-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              aria-label="Search nodes"
              placeholder="Search name or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={sortBy}
            onValueChange={(value) => value && setSortBy(value as SortOption)}
            className="shrink-0"
          >
            <ToggleGroupItem value="last_heard" aria-label="Sort by last heard">
              Last heard
            </ToggleGroupItem>
            <ToggleGroupItem value="name" aria-label="Sort by name">
              Name
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
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
          <div className="h-[260px] w-full sm:h-[600px]">
            {config.features.constellationsOnMap ? (
              <NodesAndConstellationsMap
                managedNodes={managedNodesForMap}
                observedNodes={mapNodes}
                showConstellation={true}
                showUnmanagedNodes={true}
                minHeightClassName={MAP_MIN_HEIGHT}
              />
            ) : (
              <NodesMap
                nodes={mapNodesWithPosition}
                roleLegend={config.features.roleLegend}
                minHeightClassName={MAP_MIN_HEIGHT}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {config.slug === 'meshtastic' ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Nodes</h2>
          {countLine}
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
          {countLine}
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
