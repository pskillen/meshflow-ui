import { Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { ChevronDown, Loader2 } from 'lucide-react';

import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshCoreManagedNodesSuspense } from '@/hooks/api/useMeshCore';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { MESHTASTIC_CONFIG, MESHCORE_CONFIG } from '@/lib/mesh-protocol';
import {
  ManagedNodeStatusTier,
  filterManagedNodesForMapDisplay,
  getManagedNodeStatusTier,
  managedNodeStatusTierColor,
} from '@/lib/managed-node-status';
import { ManagedNode } from '@/lib/models';

import { ManagedNodesSortKey, parseManagedNodesUrlState, updateManagedNodesUrlState } from './managed-nodes-url-state';

const STATUS_OPTIONS: Array<{ value: ManagedNodeStatusTier; label: string }> = [
  { value: 'online', label: 'Online' },
  { value: 'stale', label: 'Stale' },
  { value: 'offline', label: 'Offline' },
  { value: 'never', label: 'Never reported' },
];

const SORT_OPTIONS: Array<{ value: ManagedNodesSortKey; label: string }> = [
  { value: 'last_packet_desc', label: 'Last packet (newest first)' },
  { value: 'last_packet_asc', label: 'Last packet (oldest first)' },
  { value: 'status_asc', label: 'Status (online to never)' },
  { value: 'status_desc', label: 'Status (never to online)' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'packets_1h_desc', label: 'Packets/hour (high to low)' },
  { value: 'packets_1h_asc', label: 'Packets/hour (low to high)' },
  { value: 'packets_24h_desc', label: 'Packets/24h (high to low)' },
  { value: 'packets_24h_asc', label: 'Packets/24h (low to high)' },
  { value: 'radio_last_heard_desc', label: 'Radio heard (newest first)' },
  { value: 'radio_last_heard_asc', label: 'Radio heard (oldest first)' },
  { value: 'owner_asc', label: 'Owner (A-Z)' },
  { value: 'owner_desc', label: 'Owner (Z-A)' },
];

function compareDate(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function statusOrder(tier: ManagedNodeStatusTier): number {
  if (tier === 'online') return 0;
  if (tier === 'stale') return 1;
  if (tier === 'offline') return 2;
  return 3;
}

function tierLabel(tier: ManagedNodeStatusTier): string {
  if (tier === 'never') return 'Never';
  return tier[0].toUpperCase() + tier.slice(1);
}

function renderTimestampCell(value: Date | string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  return (
    <div className="flex flex-col">
      <span>{format(date, 'PPpp', { locale: enGB })}</span>
      <StaleReportedTime at={date} className="text-xs text-muted-foreground" />
    </div>
  );
}

function autoTracerouteBadge(node: ManagedNode) {
  if (!node.allow_auto_traceroute) return <Badge variant="outline">disabled</Badge>;
  return node.is_eligible_traceroute_source ? <Badge>eligible</Badge> : <Badge variant="secondary">stale-source</Badge>;
}

function renderBotVersionCell(node: ManagedNode) {
  if (!node.bot_version) {
    return '—';
  }
  const reportedAt = node.bot_version_reported_at ? new Date(node.bot_version_reported_at) : null;
  return (
    <div className="flex flex-col">
      <span>{node.bot_version}</span>
      {reportedAt ? (
        <StaleReportedTime at={reportedAt} className="text-xs text-muted-foreground" variant="neutral" />
      ) : null}
    </div>
  );
}

function renderAnnouncePeriodCell(node: ManagedNode) {
  const hours = node.mc_flood_advert_interval_hours ?? 6;
  return `${hours}h`;
}

function ProtocolManagedNodesPageContent({
  config,
  managedNodes,
}: {
  config: ProtocolPageConfig;
  managedNodes: ManagedNode[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(() => parseManagedNodesUrlState(searchParams).query);
  const filters = useMemo(() => parseManagedNodesUrlState(searchParams), [searchParams]);

  const updateFilters = (patch: Parameters<typeof updateManagedNodesUrlState>[1]) => {
    const next = updateManagedNodesUrlState(searchParams, patch);
    setSearchParams(next, { replace: true });
  };

  const ownerOptions = useMemo(
    () =>
      Array.from(new Set(managedNodes.map((node) => node.owner?.username).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b)
      ),
    [managedNodes]
  );
  const constellationOptions = useMemo(
    () =>
      Array.from(
        new Map(
          managedNodes
            .filter((node) => node.constellation?.id != null)
            .map((node) => [node.constellation.id, { id: node.constellation.id, name: node.constellation.name ?? '—' }])
        ).values()
      ),
    [managedNodes]
  );

  const filteredManagedNodes = useMemo(() => {
    const queryLower = filters.query.toLowerCase();
    return managedNodes.filter((node) => {
      const tier = getManagedNodeStatusTier(node.last_packet_ingested_at);
      if (filters.constellationIds.length > 0 && !filters.constellationIds.includes(node.constellation.id))
        return false;
      if (filters.statusTiers.length > 0 && !filters.statusTiers.includes(tier)) return false;
      if (filters.ownerUsernames.length > 0 && !filters.ownerUsernames.includes(node.owner.username)) return false;
      if (filters.allowAutoTraceroute != null && !!node.allow_auto_traceroute !== filters.allowAutoTraceroute)
        return false;
      if (queryLower.length > 0) {
        const haystack = `${node.long_name ?? ''} ${node.short_name ?? ''} ${node.node_id_str}`.toLowerCase();
        if (!haystack.includes(queryLower)) return false;
      }
      return true;
    });
  }, [managedNodes, filters]);

  const sortedManagedNodes = useMemo(() => {
    const sorted = [...filteredManagedNodes];
    sorted.sort((a, b) => {
      const tierA = getManagedNodeStatusTier(a.last_packet_ingested_at);
      const tierB = getManagedNodeStatusTier(b.last_packet_ingested_at);
      switch (filters.sort) {
        case 'status_asc':
          return statusOrder(tierA) - statusOrder(tierB);
        case 'status_desc':
          return statusOrder(tierB) - statusOrder(tierA);
        case 'name_asc':
          return (a.long_name ?? a.node_id_str).localeCompare(b.long_name ?? b.node_id_str);
        case 'name_desc':
          return (b.long_name ?? b.node_id_str).localeCompare(a.long_name ?? a.node_id_str);
        case 'last_packet_asc':
          return compareDate(a.last_packet_ingested_at, b.last_packet_ingested_at);
        case 'packets_1h_desc':
          return (b.packets_last_hour ?? 0) - (a.packets_last_hour ?? 0);
        case 'packets_1h_asc':
          return (a.packets_last_hour ?? 0) - (b.packets_last_hour ?? 0);
        case 'packets_24h_desc':
          return (b.packets_last_24h ?? 0) - (a.packets_last_24h ?? 0);
        case 'packets_24h_asc':
          return (a.packets_last_24h ?? 0) - (b.packets_last_24h ?? 0);
        case 'radio_last_heard_desc':
          return compareDate(b.radio_last_heard, a.radio_last_heard);
        case 'radio_last_heard_asc':
          return compareDate(a.radio_last_heard, b.radio_last_heard);
        case 'owner_asc':
          return a.owner.username.localeCompare(b.owner.username);
        case 'owner_desc':
          return b.owner.username.localeCompare(a.owner.username);
        case 'last_packet_desc':
        default:
          return compareDate(b.last_packet_ingested_at, a.last_packet_ingested_at);
      }
    });
    return sorted;
  }, [filteredManagedNodes, filters.sort]);

  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(sortedManagedNodes), [sortedManagedNodes]);

  const counts = useMemo(() => {
    const base = { total: filteredManagedNodes.length, online: 0, stale: 0, offline: 0, never: 0 };
    for (const node of filteredManagedNodes) {
      const tier = getManagedNodeStatusTier(node.last_packet_ingested_at);
      base[tier] += 1;
    }
    return base;
  }, [filteredManagedNodes]);

  const toggleFromList = <T extends string>(current: T[], value: T) =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const nodesByConstellation = useMemo(() => {
    const grouped = new Map<number, { id: number; name: string; nodes: ManagedNode[] }>();
    for (const node of sortedManagedNodes) {
      const constellationName = node.constellation.name ?? `Constellation ${node.constellation.id}`;
      const existing = grouped.get(node.constellation.id);
      if (existing) {
        existing.nodes.push(node);
      } else {
        grouped.set(node.constellation.id, {
          id: node.constellation.id,
          name: constellationName,
          nodes: [node],
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedManagedNodes]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{config.labels.managedNodesTitle}</CardTitle>
          <CardDescription>
            Operator view of feeder fleet health.
            {config.features.showInfrastructureLink ? (
              <>
                {' '}
                For RF-side observed infrastructure, use{' '}
                <Link to="/nodes/infrastructure" className="underline">
                  Mesh Infrastructure
                </Link>
                .
              </>
            ) : (
              <> MeshCore feeders reporting packets to the API.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          <Badge variant="outline">Total: {counts.total}</Badge>
          <Badge className="bg-green-700 text-white">Online: {counts.online}</Badge>
          <Badge className="bg-amber-600 text-white">Stale: {counts.stale}</Badge>
          <Badge className="bg-red-700 text-white">Offline: {counts.offline}</Badge>
          <Badge variant="secondary">Never: {counts.never}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[450px] rounded border">
            <NodesAndConstellationsMap
              managedNodes={managedNodesForMap}
              showConstellation={true}
              showUnmanagedNodes={false}
              drawPositionUncertainty={true}
              getManagedNodeMarkerColor={(node) =>
                managedNodeStatusTierColor(getManagedNodeStatusTier(node.last_packet_ingested_at))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Constellation</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {filters.constellationIds.length ? `Selected (${filters.constellationIds.length})` : 'All'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>Constellations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {constellationOptions.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.id}
                    checked={filters.constellationIds.includes(option.id)}
                    onCheckedChange={() =>
                      updateFilters({
                        constellationIds: toggleFromList(filters.constellationIds.map(String), String(option.id)).map(
                          Number
                        ),
                      })
                    }
                  >
                    {option.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {filters.statusTiers.length ? `Selected (${filters.statusTiers.length})` : 'All'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Status tiers</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filters.statusTiers.includes(option.value)}
                    onCheckedChange={() =>
                      updateFilters({ statusTiers: toggleFromList(filters.statusTiers, option.value) })
                    }
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Owner</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {filters.ownerUsernames.length ? `Selected (${filters.ownerUsernames.length})` : 'All'}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Owners</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ownerOptions.map((owner) => (
                  <DropdownMenuCheckboxItem
                    key={owner}
                    checked={filters.ownerUsernames.includes(owner)}
                    onCheckedChange={() =>
                      updateFilters({ ownerUsernames: toggleFromList(filters.ownerUsernames, owner) })
                    }
                  >
                    {owner}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onBlur={() => updateFilters({ query: queryInput })}
              placeholder="Name or node id"
            />
          </div>

          <div className="space-y-2">
            <Label>Sort</Label>
            <Select
              value={filters.sort}
              onValueChange={(value) => updateFilters({ sort: value as ManagedNodesSortKey })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.features.autoTracerouteFilters ? (
            <div className="flex items-center gap-2 lg:col-span-5">
              <Switch
                checked={filters.allowAutoTraceroute === true}
                onCheckedChange={(checked) => updateFilters({ allowAutoTraceroute: checked ? true : null })}
              />
              <Label>Allow auto traceroute only</Label>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {nodesByConstellation.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>{group.nodes.length} managed nodes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Short name</TableHead>
                    <TableHead>Long name</TableHead>
                    <TableHead>Last packet ingested</TableHead>
                    <TableHead>Packets / hour</TableHead>
                    <TableHead>Packets / 24h</TableHead>
                    <TableHead>Radio last heard</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Bot version</TableHead>
                    {config.slug === 'meshcore' ? <TableHead>Announce period</TableHead> : null}
                    {config.features.autoTracerouteFilters ? <TableHead>Auto-TR</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.nodes.map((node) => {
                    const tier = getManagedNodeStatusTier(node.last_packet_ingested_at);
                    return (
                      <TableRow key={node.node_id_str}>
                        <TableCell>
                          <Badge style={{ backgroundColor: managedNodeStatusTierColor(tier), color: 'white' }}>
                            {tierLabel(tier)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={
                              nodeDetailPath({
                                meshtastic_node_id: node.meshtastic_node_id,
                                node_id_str: node.node_id_str,
                                protocol: node.protocol,
                              }) ?? '#'
                            }
                            className="text-primary hover:underline"
                          >
                            {node.short_name ?? '—'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={
                              nodeDetailPath({
                                meshtastic_node_id: node.meshtastic_node_id,
                                node_id_str: node.node_id_str,
                                protocol: node.protocol,
                              }) ?? '#'
                            }
                            className="text-primary hover:underline"
                          >
                            {node.long_name ?? node.node_id_str}
                          </Link>
                        </TableCell>
                        <TableCell>{renderTimestampCell(node.last_packet_ingested_at)}</TableCell>
                        <TableCell>{node.packets_last_hour ?? 0}</TableCell>
                        <TableCell>{node.packets_last_24h ?? 0}</TableCell>
                        <TableCell>{renderTimestampCell(node.radio_last_heard)}</TableCell>
                        <TableCell>{node.owner.username}</TableCell>
                        <TableCell>{renderBotVersionCell(node)}</TableCell>
                        {config.slug === 'meshcore' ? <TableCell>{renderAnnouncePeriodCell(node)}</TableCell> : null}
                        {config.features.autoTracerouteFilters ? (
                          <TableCell>{autoTracerouteBadge(node)}</TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MeshtasticManagedNodesLoader({ config }: { config: ProtocolPageConfig }) {
  const { managedNodes: all } = useManagedNodesSuspense({ pageSize: 500, includeStatus: true });
  const managedNodes = useMemo(() => all.filter((n) => n.protocol === 1 || n.protocol == null), [all]);
  return <ProtocolManagedNodesPageContent config={config} managedNodes={managedNodes} />;
}

function MeshCoreManagedNodesLoader({ config }: { config: ProtocolPageConfig }) {
  const { feeders } = useMeshCoreManagedNodesSuspense({ pageSize: 500 });
  return <ProtocolManagedNodesPageContent config={config} managedNodes={feeders} />;
}

export function ProtocolManagedNodesPage({ config }: { config: ProtocolPageConfig }) {
  if (config.slug === 'meshcore') {
    return <MeshCoreManagedNodesLoader config={config} />;
  }
  return <MeshtasticManagedNodesLoader config={config} />;
}

function ManagedNodesSuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

export function ManagedNodesStatus() {
  return (
    <Suspense fallback={<ManagedNodesSuspenseFallback />}>
      <ProtocolManagedNodesPage config={MESHTASTIC_CONFIG} />
    </Suspense>
  );
}

export function MeshCoreManagedNodesStatus() {
  return (
    <Suspense fallback={<ManagedNodesSuspenseFallback />}>
      <ProtocolManagedNodesPage config={MESHCORE_CONFIG} />
    </Suspense>
  );
}

export default ManagedNodesStatus;
