import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';
import { BatteryIcon, SignalIcon } from 'lucide-react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ObservedNode } from '@/lib/models';
import { meshtasticIdToHex } from '@/lib/utils';

const columns: ColumnDef<ObservedNode>[] = [
  {
    accessorKey: 'short_name',
    header: 'Node Name',
    cell: ({ row }) => {
      const node = row.original;
      return (
        <Link to={`/nodes/${node.meshtastic_node_id}`}>
          <div>
            <div className="font-medium">{node.short_name}</div>
            <div className="text-sm text-muted-foreground">{node.long_name}</div>
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: 'last_heard',
    header: 'Last Heard',
    cell: ({ row }) => {
      const lastHeard = row.original.last_heard;
      if (!lastHeard) return <span className="text-muted-foreground">Never</span>;

      return (
        <div className="flex items-center gap-2">
          <SignalIcon className="h-4 w-4 text-green-500" />
          <StaleReportedTime at={lastHeard} className="inline" />
        </div>
      );
    },
  },
  {
    accessorKey: 'latest_device_metrics',
    header: 'Battery',
    cell: ({ row }) => {
      const metrics = row.original.latest_device_metrics;
      if (!metrics) return <span className="text-muted-foreground">Unknown</span>;

      const batteryLevel = metrics.battery_level;
      let batteryColor = 'text-red-500';

      if (batteryLevel > 70) {
        batteryColor = 'text-green-500';
      } else if (batteryLevel > 30) {
        batteryColor = 'text-yellow-500';
      }

      return (
        <div className="flex items-center gap-2">
          <BatteryIcon className={`h-4 w-4 ${batteryColor}`} />
          <span>{batteryLevel}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'id',
    header: 'Node ID',
    cell: ({ row }) => {
      return <span className="font-mono text-sm">{meshtasticIdToHex(row.original.meshtastic_node_id)}</span>;
    },
  },
];

interface NodeActivityTableProps {
  nodes: ObservedNode[];
  isLoading?: boolean;
  isLoadingMore?: boolean;
}

export function NodeActivityTable({ nodes, isLoading = false, isLoadingMore = false }: NodeActivityTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'last_heard', desc: true }]);

  const table = useReactTable({
    data: nodes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    initialState: {
      sorting: [{ id: 'last_heard', desc: true }],
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Node Activity
          {isLoadingMore && (
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></span>
          )}
        </CardTitle>
        <CardDescription>Recent activity from nodes in the network</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No nodes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end space-x-2 py-4 px-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
