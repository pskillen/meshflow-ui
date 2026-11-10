import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ObservedNode } from '@/lib/models';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { getRoleLabel } from '@/lib/meshtastic';
import { describeBattery } from '@/lib/battery';
import { cn } from '@/lib/utils';

export type NodesTableSortKey = 'name' | 'id' | 'role' | 'hardware' | 'battery' | 'prefix' | 'position' | 'heard';
export type NodesTableSort = { key: NodesTableSortKey; dir: 'asc' | 'desc' };

const DEFAULT_SORT: NodesTableSort = { key: 'heard', dir: 'desc' };
const TEXT_KEYS: NodesTableSortKey[] = ['name', 'id', 'role', 'hardware', 'prefix'];

const hasPosition = (n: ObservedNode) => n.latest_position?.latitude != null && n.latest_position?.longitude != null;

/** Battery rank: no reading is null (always last); Powered ranks above 100%; a real 0 is a reading. */
function batteryRank(n: ObservedNode): number | null {
  const d = describeBattery(n.latest_device_metrics?.battery_level);
  if (d.kind === 'none') return null;
  return d.kind === 'powered' ? 101 : d.pct;
}

/** A sort value; null means "missing", which sorts after every present value in either direction. */
function sortValue(n: ObservedNode, key: NodesTableSortKey): string | number | null {
  switch (key) {
    case 'name':
      return n.short_name || n.long_name || null;
    case 'id':
      return n.node_id_str || null;
    case 'role':
      return getRoleLabel(n.meshtastic_role) ?? null;
    case 'hardware':
      return n.meshtastic_hw_model || null;
    case 'battery':
      return batteryRank(n);
    case 'prefix':
      return n.mc_pubkey_prefix || null;
    case 'position':
      // "None" is missing, like a missing battery reading: last in either direction.
      return hasPosition(n) ? 1 : null;
    case 'heard':
      return n.last_heard ? n.last_heard.getTime() : null;
  }
}

function sortObservedNodes(nodes: ObservedNode[], sort: NodesTableSort): ObservedNode[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    const av = sortValue(a, sort.key);
    const bv = sortValue(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string' && typeof bv === 'string') return sign * av.localeCompare(bv);
    return sign * ((av as number) - (bv as number));
  });
}

type NodesTableProps = {
  nodes: ObservedNode[];
  config: ProtocolPageConfig;
  emptyMessage?: string;
  /** Accessible name for the table. */
  'aria-label'?: string;
};

/**
 * Sortable table of observed nodes. Meshtastic: name, ID, role, hardware, battery, last heard.
 * MeshCore: name, ID, prefix, position, last heard. Name is the primary label; ID is supporting detail.
 */
export function NodesTable({
  nodes,
  config,
  emptyMessage = 'No nodes in this range.',
  'aria-label': ariaLabel,
}: NodesTableProps) {
  const [sort, setSort] = useState<NodesTableSort>(DEFAULT_SORT);
  const isMeshtastic = config.slug === 'meshtastic';
  const rows = useMemo(() => sortObservedNodes(nodes, sort), [nodes, sort]);

  const onSort = (key: NodesTableSortKey) =>
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : // Text columns start A to Z; battery, position and time start with the largest or latest first.
          { key, dir: TEXT_KEYS.includes(key) ? 'asc' : 'desc' }
    );

  const head = (key: NodesTableSortKey, label: string, className?: string): ReactNode => {
    const active = sort.key === key;
    const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={className}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        data-sort-key={key}
      >
        <button
          type="button"
          onClick={() => onSort(key)}
          className={cn(
            'inline-flex items-center gap-1 hover:text-foreground',
            active && 'font-medium text-foreground',
            className?.includes('text-right') && 'flex-row-reverse'
          )}
        >
          {label}
          {active && <Arrow className="h-3 w-3" aria-hidden />}
        </button>
      </TableHead>
    );
  };

  const columnCount = 5 + (isMeshtastic ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-testid="nodes-table">
      <Table className="text-sm" aria-label={ariaLabel}>
        <TableHeader>
          <TableRow>
            {head('name', 'Node')}
            {head('id', 'ID', 'hidden lg:table-cell')}
            {isMeshtastic ? (
              <>
                {head('role', 'Role', 'hidden lg:table-cell')}
                {head('hardware', 'Hardware', 'hidden lg:table-cell')}
                {head('battery', 'Battery', 'text-right')}
              </>
            ) : (
              <>
                {head('prefix', 'Prefix', 'hidden lg:table-cell')}
                {head('position', 'Position')}
              </>
            )}
            {head('heard', 'Last heard', 'text-right')}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-20 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((node) => <NodeRow key={String(node.internal_id)} node={node} config={config} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function BatteryCell({ raw }: { raw: number | null | undefined }) {
  const d = describeBattery(raw);
  if (d.kind === 'none') return <span className="text-muted-foreground">—</span>;
  if (d.kind === 'powered') return <span>Powered</span>;
  const tone = { good: 'text-emerald-500', warn: 'text-amber-500', low: 'text-red-500' }[d.tone];
  return <span className={tone}>{d.pct}%</span>;
}

function NodeRow({ node, config }: { node: ObservedNode; config: ProtocolPageConfig }) {
  const isMeshtastic = config.slug === 'meshtastic';
  const to = config.routes.nodeDetail(String(node.internal_id));
  const primary = node.short_name || node.long_name || node.node_id_str || '—';
  return (
    <TableRow data-testid="node-row">
      {/* w-full + max-w-0: the Node column takes the remaining width and truncates. */}
      <TableCell className="w-full max-w-0 py-1.5">
        <Link to={to} className="block min-w-0 hover:underline">
          <div className="truncate font-medium md:max-w-[320px]">{primary}</div>
          {node.long_name && node.long_name !== primary && (
            <div className="truncate text-xs text-muted-foreground md:max-w-[320px]">{node.long_name}</div>
          )}
        </Link>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap py-1.5 font-mono text-xs lg:table-cell">
        {node.node_id_str}
      </TableCell>
      {isMeshtastic ? (
        <>
          <TableCell className="hidden py-1.5 lg:table-cell">{getRoleLabel(node.meshtastic_role) ?? '—'}</TableCell>
          <TableCell className="hidden py-1.5 text-xs lg:table-cell">{node.meshtastic_hw_model || '—'}</TableCell>
          <TableCell className="py-1.5 text-right tabular-nums">
            <BatteryCell raw={node.latest_device_metrics?.battery_level} />
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="hidden py-1.5 font-mono text-xs lg:table-cell">
            {node.mc_pubkey_prefix || '—'}
          </TableCell>
          <TableCell className="py-1.5">
            {hasPosition(node) ? 'Known' : <span className="text-muted-foreground">None</span>}
          </TableCell>
        </>
      )}
      <TableCell className="whitespace-nowrap py-1.5 text-right tabular-nums">
        <StaleReportedTime at={node.last_heard ?? null} fallback="Never" className="text-inherit" compact />
      </TableCell>
    </TableRow>
  );
}
