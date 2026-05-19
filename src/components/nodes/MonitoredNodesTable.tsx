import { ObservedNode } from '@/lib/models';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface MonitoredNodesTableProps {
  nodes: ObservedNode[];
  onRemoveNode: (nodeId: number) => void;
  isLoadingMore?: boolean;
  editable?: boolean;
  title?: string;
  description?: string;
}

export function MonitoredNodesTable({
  nodes,
  onRemoveNode,
  isLoadingMore,
  editable = true,
  title = 'Monitored Nodes',
  description = 'List of nodes being actively monitored',
}: MonitoredNodesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {isLoadingMore && (
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Short Name</TableHead>
              <TableHead>Long Name</TableHead>
              <TableHead>Last Heard</TableHead>
              <TableHead>Battery</TableHead>
              <TableHead>Position</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.map((node) => (
              <TableRow key={node.meshtastic_node_id}>
                <TableCell>
                  <div>
                    {node.short_name || node.node_id_str}
                    <div className="text-xs text-muted-foreground">{node.node_id_str}</div>
                  </div>
                </TableCell>
                <TableCell>{node.long_name || '-'}</TableCell>
                <TableCell>{node.last_heard ? node.last_heard.toLocaleString() : 'Never'}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div>
                      {node.latest_device_metrics?.battery_level ? `${node.latest_device_metrics.battery_level}%` : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {node.latest_device_metrics?.voltage ? `${node.latest_device_metrics.voltage.toFixed(2)}V` : '-'}
                    </div>
                    {node.latest_device_metrics?.reported_time && (
                      <div className="text-xs text-muted-foreground">
                        Updated: {node.latest_device_metrics.reported_time.toLocaleString()}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {node.latest_position &&
                  typeof node.latest_position.latitude === 'number' &&
                  typeof node.latest_position.longitude === 'number' ? (
                    <div className="space-y-1">
                      <div>
                        {node.latest_position.latitude.toFixed(6)}, {node.latest_position.longitude.toFixed(6)}
                      </div>
                      {node.latest_position.reported_time && (
                        <div className="text-xs text-muted-foreground">
                          Updated: {node.latest_position.reported_time.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveNode(node.meshtastic_node_id)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
