import { ObservedNode } from '@/lib/models';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';

interface NodeSelectorProps {
  nodes: ObservedNode[];
  onSelect: (nodeId: number) => void;
  onCancel: () => void;
  excludeNodes?: number[];
}

export function NodeSelector({ nodes, onSelect, onCancel, excludeNodes = [] }: NodeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  // First filter: exclude already selected nodes
  const nodesAfterExclusion = nodes.filter((node) => !excludeNodes.includes(node.meshtastic_node_id));

  // Second filter: search query
  const availableNodes = nodesAfterExclusion.filter((node) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      node.long_name?.toLowerCase().includes(query) ||
      node.short_name?.toLowerCase().includes(query) ||
      node.node_id_str.toLowerCase().includes(query)
    );
  });

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Select Node to Monitor</span>
            <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)}>
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </Button>
          </DialogTitle>
          <DialogDescription>
            Choose a node from the list below to add it to your monitoring dashboard.
            {showDebug && (
              <div className="mt-2 text-xs font-mono bg-muted p-2 rounded">
                <div>Total nodes: {nodes.length}</div>
                <div>After exclusion: {nodesAfterExclusion.length}</div>
                <div>After search: {availableNodes.length}</div>
                <div>Excluded IDs: {excludeNodes.join(', ')}</div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Short Name</TableHead>
                <TableHead>Long Name</TableHead>
                <TableHead>Last Heard</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableNodes.map((node) => (
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
                    {node.latest_device_metrics?.battery_level ? `${node.latest_device_metrics.battery_level}%` : '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="secondary" size="sm" onClick={() => onSelect(node.meshtastic_node_id)}>
                      Monitor
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {availableNodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    {searchQuery ? (
                      <span>No nodes match your search query</span>
                    ) : (
                      <span>No nodes available to monitor</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
