import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { HeatmapNode } from '@/hooks/api/useHeatmapEdges';
import { getHeatmapNodeLabel } from '@/components/traceroutes/heatmapEncoding';

function byCentralityDesc(a: HeatmapNode, b: HeatmapNode): number {
  return (b.centrality ?? 0) - (a.centrality ?? 0);
}

const SCROLL_AREA_HEIGHT = 'h-56'; /* 14rem; fixed so both panels align */

function MetricsColumnDescriptions() {
  return (
    <div className="text-muted-foreground mb-4 space-y-1.5 text-sm leading-snug">
      <p>
        <span className="text-foreground font-medium">Centrality</span> — Normalised betweenness for this filtered
        graph, shown as 0–100%. Higher values mean more shortest traceroute paths between other nodes pass through this
        node.
      </p>
      <p>
        <span className="text-foreground font-medium">Degree</span> — Number of distinct neighbours (other nodes linked
        by at least one edge) in this filtered graph.
      </p>
    </div>
  );
}

function RoleNodeTable({ nodes }: { nodes: HeatmapNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full min-h-[4rem] items-center justify-center px-3 text-sm">
        None for these filters.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-card sticky top-0 z-[1] shadow-[0_1px_0_0_hsl(var(--border))]">
        <TableRow>
          <TableHead className="w-[48%]">Node</TableHead>
          <TableHead className="text-right">Centrality</TableHead>
          <TableHead className="text-right">Degree</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((n) => (
          <TableRow key={n.meshtastic_node_id}>
            <TableCell>
              <Link
                to={nodeDetailPath({ meshtastic_node_id: n.meshtastic_node_id, node_id_str: n.node_id_str })}
                className="font-medium text-primary hover:underline"
              >
                {getHeatmapNodeLabel(n)}
              </Link>
              <div className="text-muted-foreground text-xs">
                {n.node_id_str ?? `!${n.meshtastic_node_id.toString(16)}`}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {n.centrality != null ? `${(n.centrality * 100).toFixed(1)}%` : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">{n.degree ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TracerouteHeatmapBackboneRelayTable({ nodes }: { nodes: HeatmapNode[] }) {
  const backbone = useMemo(() => nodes.filter((n) => n.role === 'backbone').sort(byCentralityDesc), [nodes]);
  const relay = useMemo(() => nodes.filter((n) => n.role === 'relay').sort(byCentralityDesc), [nodes]);

  if (backbone.length === 0 && relay.length === 0) {
    return (
      <Card data-testid="heatmap-backbone-relay-table">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Backbone and relay nodes</CardTitle>
          <CardDescription>
            Nodes classified from mesh topology (betweenness and degree). Same roles as on the map and topology views.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4 pt-0 sm:px-6">
          <MetricsColumnDescriptions />
          <p className="text-muted-foreground text-sm">
            No backbone or relay nodes in this graph for the current filters.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="heatmap-backbone-relay-table">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Backbone and relay nodes</CardTitle>
        <CardDescription>
          Nodes classified from mesh topology (betweenness and degree). Same roles as on the map and topology views.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-0 sm:px-6">
        <MetricsColumnDescriptions />
        <div className="grid gap-6 md:grid-cols-2">
          <section data-testid="heatmap-backbone-list">
            <h3 className="text-foreground mb-2 text-sm font-semibold tracking-tight">Backbone</h3>
            <div
              className={`border-border bg-card overflow-x-auto overflow-y-auto rounded-md border ${SCROLL_AREA_HEIGHT}`}
            >
              <RoleNodeTable nodes={backbone} />
            </div>
          </section>
          <section data-testid="heatmap-relay-list">
            <h3 className="text-foreground mb-2 text-sm font-semibold tracking-tight">Relay</h3>
            <div
              className={`border-border bg-card overflow-x-auto overflow-y-auto rounded-md border ${SCROLL_AREA_HEIGHT}`}
            >
              <RoleNodeTable nodes={relay} />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
