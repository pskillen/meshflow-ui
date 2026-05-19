import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMeshCoreNodesSuspense } from '@/hooks/api/useMeshCore';
import { ObservedNode } from '@/lib/models';
import { formatDistanceToNow } from 'date-fns';
import { Suspense, useMemo } from 'react';

function formatPosition(node: ObservedNode): string {
  const lat = node.latest_position?.latitude;
  const lon = node.latest_position?.longitude;
  if (lat == null || lon == null) return '—';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function NodeTable({ title, nodes }: { title: string; nodes: ObservedNode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Last heard</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No nodes in this section yet.
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((node) => (
                <TableRow key={String(node.internal_id)}>
                  <TableCell className="font-mono text-xs">{node.node_id_str}</TableCell>
                  <TableCell>
                    {node.long_name || '—'} / {node.short_name || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{node.mc_pubkey_prefix || '—'}</TableCell>
                  <TableCell>{formatPosition(node)}</TableCell>
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

function MeshCoreNodesListContent() {
  const { nodes } = useMeshCoreNodesSuspense({ pageSize: 500 });

  const { withLocation, identityOnly } = useMemo(() => {
    const withLoc: ObservedNode[] = [];
    const noLoc: ObservedNode[] = [];
    for (const n of nodes) {
      if (n.latest_position?.latitude != null && n.latest_position?.longitude != null) {
        withLoc.push(n);
      } else {
        noLoc.push(n);
      }
    }
    return { withLocation: withLoc, identityOnly: noLoc };
  }, [nodes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">MeshCore nodes</h1>
        <p className="text-sm text-muted-foreground">
          All observed MeshCore nodes (separate from the Meshtastic node list).
        </p>
      </div>
      <NodeTable title={`With location (${withLocation.length})`} nodes={withLocation} />
      <NodeTable title={`Identity only / no position (${identityOnly.length})`} nodes={identityOnly} />
    </div>
  );
}

export function MeshCoreNodesList() {
  return (
    <Suspense fallback={<div>Loading MeshCore nodes…</div>}>
      <MeshCoreNodesListContent />
    </Suspense>
  );
}
