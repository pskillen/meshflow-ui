import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  type FilterFn,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { ChevronDown, Copy, Download, Terminal } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { infrastructureRowsToCsv, downloadCsv, downloadTextFile, type CsvColumnDef } from '@/lib/infrastructure-csv';
import { buildSetFavoriteNodeCommands, countSetFavoriteNodeCommands } from '@/lib/infrastructure-meshtastic-cli';
import type { InfrastructureExportRow } from '@/lib/infrastructure-export-rows';
import { nodeDetailPath } from '@/lib/node-detail-routes';

export const INFRA_EXPORT_ROLE_OPTIONS = ['ROUTER', 'ROUTER_CLIENT', 'REPEATER', 'ROUTER_LATE', 'CLIENT_BASE'] as const;

/** Default role filter: standard infrastructure roles, excluding CLIENT_BASE. */
export const DEFAULT_INCLUDED_INFRA_ROLES: readonly string[] = ['ROUTER', 'ROUTER_CLIENT', 'REPEATER', 'ROUTER_LATE'];

type TriState = 'all' | 'yes' | 'no';

const triStateFilter: FilterFn<InfrastructureExportRow> = (row, columnId, filterValue) => {
  const v = filterValue as TriState;
  if (!v || v === 'all') return true;
  const cell = row.getValue(columnId) as boolean | null;
  if (v === 'yes') return cell === true;
  return cell !== true;
};

const roleFilter: FilterFn<InfrastructureExportRow> = (row, columnId, filterValue) => {
  const allowed = filterValue as string[] | undefined;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(String(row.getValue(columnId)));
};

function parseRoleFilterValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (typeof value === 'string' && value !== 'all') return [value];
  return [];
}

export const INFRASTRUCTURE_EXPORT_CSV_COLUMNS: CsvColumnDef<InfrastructureExportRow>[] = [
  { id: 'node_id_str', header: 'Node ID', getValue: (r) => r.node_id_str },
  { id: 'short_name', header: 'Short name', getValue: (r) => r.short_name },
  { id: 'long_name', header: 'Long name', getValue: (r) => r.long_name },
  { id: 'role_label', header: 'Role', getValue: (r) => r.role_label },
  { id: 'hw_model', header: 'HW model', getValue: (r) => r.hw_model },
  { id: 'last_heard_iso', header: 'Last heard', getValue: (r) => r.last_heard_iso },
  { id: 'latitude', header: 'Latitude', getValue: (r) => r.latitude },
  { id: 'longitude', header: 'Longitude', getValue: (r) => r.longitude },
  { id: 'altitude', header: 'Altitude', getValue: (r) => r.altitude },
  { id: 'battery_percent', header: 'Battery %', getValue: (r) => r.battery_percent },
  { id: 'channel_util_percent', header: 'Channel util %', getValue: (r) => r.channel_util_percent },
  { id: 'owner_username', header: 'Owner', getValue: (r) => r.owner_username },
  {
    id: 'is_managed_feeder',
    header: 'Managed feeder',
    getValue: (r) => (r.is_managed_feeder ? 'Yes' : 'No'),
  },
  { id: 'constellation_name', header: 'Constellation', getValue: (r) => r.constellation_name },
  {
    id: 'is_licensed',
    header: 'Licensed',
    getValue: (r) => (r.is_licensed == null ? '' : r.is_licensed ? 'Yes' : 'No'),
  },
  {
    id: 'has_rf_profile',
    header: 'RF profile',
    getValue: (r) => (r.has_rf_profile ? 'Yes' : 'No'),
  },
  {
    id: 'has_ready_rf_render',
    header: 'RF render ready',
    getValue: (r) => (r.has_ready_rf_render ? 'Yes' : 'No'),
  },
];

function formatLastHeard(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'PPpp', { locale: enGB });
}

function boolCell(value: boolean | null): string {
  if (value === null) return '—';
  return value ? 'Yes' : 'No';
}

const columns: ColumnDef<InfrastructureExportRow>[] = [
  {
    accessorKey: 'node_id_str',
    header: 'Node ID',
    filterFn: 'includesString',
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.node_id_str}</span>,
  },
  {
    id: 'name',
    accessorFn: (r) => `${r.short_name} ${r.long_name}`,
    header: 'Name',
    filterFn: 'includesString',
    cell: ({ row }) => (
      <Link
        to={nodeDetailPath({ node_id_str: row.original.node_id_str }) ?? '#'}
        className="text-primary hover:underline"
      >
        <div className="font-medium">{row.original.long_name || row.original.short_name || '—'}</div>
        {row.original.short_name && row.original.long_name && (
          <div className="text-xs text-muted-foreground">{row.original.short_name}</div>
        )}
      </Link>
    ),
  },
  {
    accessorKey: 'role_label',
    header: 'Role',
    filterFn: roleFilter,
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'hw_model',
    header: 'HW model',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'last_heard_iso',
    header: 'Last heard',
    filterFn: 'includesString',
    cell: ({ getValue }) => formatLastHeard(String(getValue() ?? '')),
  },
  {
    accessorKey: 'latitude',
    header: 'Latitude',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'longitude',
    header: 'Longitude',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'battery_percent',
    header: 'Battery %',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'channel_util_percent',
    header: 'Ch util %',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'owner_username',
    header: 'Owner',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'is_managed_feeder',
    header: 'Managed',
    filterFn: triStateFilter,
    cell: ({ getValue }) => boolCell(getValue() as boolean),
  },
  {
    accessorKey: 'constellation_name',
    header: 'Constellation',
    filterFn: 'includesString',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'is_licensed',
    header: 'Licensed',
    filterFn: triStateFilter,
    cell: ({ getValue }) => boolCell(getValue() as boolean | null),
  },
  {
    accessorKey: 'has_rf_profile',
    header: 'RF profile',
    filterFn: triStateFilter,
    cell: ({ getValue }) => boolCell(getValue() as boolean),
  },
  {
    accessorKey: 'has_ready_rf_render',
    header: 'RF render',
    filterFn: triStateFilter,
    cell: ({ getValue }) => boolCell(getValue() as boolean),
  },
];

function TriStateFilter({ value, onChange, id }: { value: TriState; onChange: (v: TriState) => void; id: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TriState)}>
      <SelectTrigger className="h-8 w-full" id={id} aria-label={`Filter ${id}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
      </SelectContent>
    </Select>
  );
}

export interface InfrastructureExportTableProps {
  rows: InfrastructureExportRow[];
}

function RoleFilterMenu({ includedRoles, onChange }: { includedRoles: string[]; onChange: (roles: string[]) => void }) {
  const effectiveRoles = includedRoles.length === 0 ? [...INFRA_EXPORT_ROLE_OPTIONS] : includedRoles;

  const label =
    includedRoles.length === 0 || includedRoles.length === INFRA_EXPORT_ROLE_OPTIONS.length
      ? 'All roles'
      : `${includedRoles.length} roles`;

  const toggleRole = (role: string, checked: boolean) => {
    const base = includedRoles.length === 0 ? [...INFRA_EXPORT_ROLE_OPTIONS] : [...includedRoles];
    if (checked) {
      onChange([...new Set([...base, role])]);
    } else {
      const next = base.filter((r) => r !== role);
      onChange(next);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-full justify-between font-normal">
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {INFRA_EXPORT_ROLE_OPTIONS.map((role) => (
          <DropdownMenuCheckboxItem
            key={role}
            checked={effectiveRoles.includes(role)}
            onCheckedChange={(checked) => toggleRole(role, checked === true)}
            onSelect={(e) => e.preventDefault()}
          >
            {role}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InfrastructureExportTable({ rows }: InfrastructureExportTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'last_heard_iso', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    { id: 'role_label', value: [...DEFAULT_INCLUDED_INFRA_ROLES] },
  ]);
  const [routersOnly, setRoutersOnly] = React.useState(false);
  const [connectionArgs, setConnectionArgs] = React.useState('');
  const [destNodeId, setDestNodeId] = React.useState('');

  React.useEffect(() => {
    setColumnFilters((prev) => {
      const withoutRole = prev.filter((f) => f.id !== 'role_label');
      if (!routersOnly) {
        return [...withoutRole, { id: 'role_label', value: [...DEFAULT_INCLUDED_INFRA_ROLES] }];
      }
      return [...withoutRole, { id: 'role_label', value: ['ROUTER'] }];
    });
  }, [routersOnly]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const filteredRows = table.getFilteredRowModel().rows.map((r) => r.original);
  const filteredCount = filteredRows.length;
  const totalCount = rows.length;

  const dateStamp = new Date().toISOString().slice(0, 10);

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleCopyCsv = () => {
    if (filteredCount === 0) {
      toast.message('No rows to export');
      return;
    }
    const csv = infrastructureRowsToCsv(filteredRows, INFRASTRUCTURE_EXPORT_CSV_COLUMNS);
    void copyToClipboard(csv, `Copied CSV (${filteredCount} rows)`);
  };

  const handleDownloadCsv = () => {
    if (filteredCount === 0) {
      toast.message('No rows to export');
      return;
    }
    const csv = infrastructureRowsToCsv(filteredRows, INFRASTRUCTURE_EXPORT_CSV_COLUMNS);
    downloadCsv(`meshflow-infrastructure-${dateStamp}.csv`, csv);
    toast.success(`Downloaded ${filteredCount} rows`);
  };

  const cliOptions = React.useMemo(
    () => ({
      connectionArgs: connectionArgs.trim() || undefined,
      destNodeId: destNodeId.trim() || undefined,
    }),
    [connectionArgs, destNodeId]
  );

  const handleCopyCli = () => {
    const script = buildSetFavoriteNodeCommands(filteredRows, cliOptions);
    const count = countSetFavoriteNodeCommands(filteredRows, { ...cliOptions, includeHeader: false });
    if (count === 0) {
      toast.message('No valid node IDs in filtered rows (or invalid admin target)');
      return;
    }
    void copyToClipboard(script, `Copied ${count} CLI command${count === 1 ? '' : 's'}`);
  };

  const handleDownloadCli = () => {
    const script = buildSetFavoriteNodeCommands(filteredRows, cliOptions);
    const count = countSetFavoriteNodeCommands(filteredRows, { ...cliOptions, includeHeader: false });
    if (count === 0) {
      toast.message('No valid node IDs in filtered rows');
      return;
    }
    downloadTextFile(`meshflow-favorites-${dateStamp}.sh`, script, 'text/plain;charset=utf-8');
    toast.success(`Downloaded ${count} commands`);
  };

  const setColumnFilter = (id: string, value: unknown) => {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      if (value === '' || value === 'all' || value == null) return rest;
      return [...rest, { id, value }];
    });
  };

  const getFilterValue = (id: string): string => {
    const f = columnFilters.find((c) => c.id === id);
    return f?.value != null ? String(f.value) : '';
  };

  if (totalCount === 0) {
    return <p className="text-center text-muted-foreground py-12">No infrastructure nodes in this time range.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Meshtastic CLI tools</CardTitle>
          <CardDescription>
            Used for &quot;Copy CLI favorite commands&quot;. See{' '}
            <a
              href="https://meshtastic.org/docs/software/python/cli/"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Meshtastic CLI
            </a>{' '}
            (<code className="text-xs">--set-favorite-node</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cli-connection">Connection prefix (optional)</Label>
              <Input
                id="cli-connection"
                placeholder="e.g. -b MyRadio or --host meshtastic.local"
                value={connectionArgs}
                onChange={(e) => setConnectionArgs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cli-dest">Admin target --dest (optional)</Label>
              <Input
                id="cli-dest"
                placeholder="e.g. !a5592387"
                value={destNodeId}
                onChange={(e) => setDestNodeId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" size="sm" onClick={handleCopyCli}>
              <Terminal className="h-4 w-4 mr-1" />
              Copy CLI favorite commands
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadCli}>
              <Download className="h-4 w-4 mr-1" />
              Download .sh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopyCsv}>
          <Copy className="h-4 w-4 mr-1" />
          Copy CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadCsv}>
          <Download className="h-4 w-4 mr-1" />
          Download CSV
        </Button>
        <Button
          type="button"
          variant={routersOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRoutersOnly((v) => !v)}
        >
          Routers only
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          Showing {filteredCount} of {totalCount} nodes
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="font-medium hover:underline text-left"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? null}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
            <TableRow className="bg-muted/50">
              <TableHead>
                <Input
                  className="h-8"
                  placeholder="Filter…"
                  value={getFilterValue('node_id_str')}
                  onChange={(e) => setColumnFilter('node_id_str', e.target.value)}
                  aria-label="Filter node ID"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  placeholder="Filter…"
                  value={getFilterValue('name')}
                  onChange={(e) => setColumnFilter('name', e.target.value)}
                  aria-label="Filter name"
                />
              </TableHead>
              <TableHead>
                <RoleFilterMenu
                  includedRoles={parseRoleFilterValue(columnFilters.find((f) => f.id === 'role_label')?.value)}
                  onChange={(roles) => {
                    setRoutersOnly(false);
                    setColumnFilters((prev) => {
                      const rest = prev.filter((f) => f.id !== 'role_label');
                      if (roles.length === 0 || roles.length === INFRA_EXPORT_ROLE_OPTIONS.length) {
                        return rest;
                      }
                      return [...rest, { id: 'role_label', value: roles }];
                    });
                  }}
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('hw_model')}
                  onChange={(e) => setColumnFilter('hw_model', e.target.value)}
                  aria-label="Filter HW model"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('last_heard_iso')}
                  onChange={(e) => setColumnFilter('last_heard_iso', e.target.value)}
                  aria-label="Filter last heard"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('latitude')}
                  onChange={(e) => setColumnFilter('latitude', e.target.value)}
                  aria-label="Filter latitude"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('longitude')}
                  onChange={(e) => setColumnFilter('longitude', e.target.value)}
                  aria-label="Filter longitude"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('battery_percent')}
                  onChange={(e) => setColumnFilter('battery_percent', e.target.value)}
                  aria-label="Filter battery"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('channel_util_percent')}
                  onChange={(e) => setColumnFilter('channel_util_percent', e.target.value)}
                  aria-label="Filter channel util"
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('owner_username')}
                  onChange={(e) => setColumnFilter('owner_username', e.target.value)}
                  aria-label="Filter owner"
                />
              </TableHead>
              <TableHead>
                <TriStateFilter
                  id="managed"
                  value={(getFilterValue('is_managed_feeder') as TriState) || 'all'}
                  onChange={(v) => setColumnFilter('is_managed_feeder', v)}
                />
              </TableHead>
              <TableHead>
                <Input
                  className="h-8"
                  value={getFilterValue('constellation_name')}
                  onChange={(e) => setColumnFilter('constellation_name', e.target.value)}
                  aria-label="Filter constellation"
                />
              </TableHead>
              <TableHead>
                <TriStateFilter
                  id="licensed"
                  value={(getFilterValue('is_licensed') as TriState) || 'all'}
                  onChange={(v) => setColumnFilter('is_licensed', v)}
                />
              </TableHead>
              <TableHead>
                <TriStateFilter
                  id="rf-profile"
                  value={(getFilterValue('has_rf_profile') as TriState) || 'all'}
                  onChange={(v) => setColumnFilter('has_rf_profile', v)}
                />
              </TableHead>
              <TableHead>
                <TriStateFilter
                  id="rf-render"
                  value={(getFilterValue('has_ready_rf_render') as TriState) || 'all'}
                  onChange={(v) => setColumnFilter('has_ready_rf_render', v)}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No rows match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  );
}
