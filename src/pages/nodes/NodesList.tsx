import { useNodesSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { subDays, subHours } from 'date-fns';
import { useMemo, useState, Suspense } from 'react';
import { NodeCard } from '@/components/nodes/NodeCard';
import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ObservedNode } from '@/lib/models';
import { Link } from 'react-router-dom';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';

type TimeRangeOption = '2h' | '24h' | '7d' | '30d' | 'all';
type SortOption = 'last_heard' | 'name';

const TIME_RANGE_OPTIONS: { value: TimeRangeOption; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function getLastHeardAfter(timeRange: TimeRangeOption): Date | undefined {
  if (timeRange === 'all') return undefined;
  const now = new Date();
  switch (timeRange) {
    case '2h':
      return subHours(now, 2);
    case '24h':
      return subHours(now, 24);
    case '7d':
      return subDays(now, 7);
    case '30d':
      return subDays(now, 30);
    default:
      return subDays(now, 7);
  }
}

function RecentNodeChip({ node }: { node: ObservedNode }) {
  return (
    <Link
      to={`/nodes/${node.meshtastic_node_id}`}
      className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
    >
      <span className="font-medium text-sm truncate max-w-[120px]">{node.short_name}</span>
      <span className="text-xs text-muted-foreground">
        <StaleReportedTime at={node.last_heard ?? null} fallback="Never" className="text-inherit" />
      </span>
    </Link>
  );
}

function NodesListContent() {
  const now = useMemo(() => new Date(), []);
  const twoHoursAgo = useMemo(() => subHours(now, 2), [now]);

  const [timeRange, setTimeRange] = useState<TimeRangeOption>('7d');
  const [sortBy, setSortBy] = useState<SortOption>('last_heard');
  const [searchQuery, setSearchQuery] = useState('');

  const lastHeardAfter = useMemo(() => getLastHeardAfter(timeRange), [timeRange]);

  // Recent bar: nodes seen in last 2 hours
  const { nodes: recentNodes } = useNodesSuspense({
    lastHeardAfter: twoHoursAgo,
    pageSize: 20,
  });

  // Main list: nodes in selected time range
  const {
    nodes: mainListNodes,
    totalNodes,
    fetchNextPage,
    hasNextPage,
  } = useNodesSuspense({
    lastHeardAfter,
    pageSize: 100,
  });

  const { managedNodes } = useManagedNodesSuspense({ pageSize: 500, includeStatus: true });
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  const sortNodes = (nodes: ObservedNode[]) => {
    return [...nodes].sort((a, b) => {
      if (sortBy === 'last_heard') {
        if (!a.last_heard) return 1;
        if (!b.last_heard) return -1;
        return b.last_heard.getTime() - a.last_heard.getTime();
      } else {
        const aName = a.long_name || '';
        const bName = b.long_name || '';
        return aName.localeCompare(bName);
      }
    });
  };

  const filterNodes = (nodes: ObservedNode[]) => {
    if (!searchQuery) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (node) =>
        node.long_name?.toLowerCase().includes(query) ||
        node.short_name?.toLowerCase().includes(query) ||
        node.node_id_str?.toLowerCase().includes(query)
    );
  };

  const displayedNodes = sortNodes(filterNodes(mainListNodes || []));

  // Map nodes: same as main list, filtered by time range and search
  const mapNodes = searchQuery ? filterNodes(mainListNodes || []) : mainListNodes || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">Meshtastic Nodes</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="time-range" className="text-sm text-muted-foreground">
              Time range:
            </label>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
              <SelectTrigger className="w-[180px]" id="time-range" aria-label="Select time range">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((opt) => (
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

      {/* Recent bar: nodes seen in last 2 hours */}
      {recentNodes.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Seen in last 2 hours</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {recentNodes.map((node) => (
                <RecentNodeChip key={node.internal_id} node={node} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          <CardTitle>Mesh Nodes and Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[600px] w-full">
            <NodesAndConstellationsMap
              managedNodes={managedNodesForMap}
              observedNodes={mapNodes}
              showConstellation={true}
              showUnmanagedNodes={true}
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}

export function NodesList() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <NodesListContent />
    </Suspense>
  );
}
