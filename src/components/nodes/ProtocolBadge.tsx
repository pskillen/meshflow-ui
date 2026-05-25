import { Badge } from '@/components/ui/badge';
import { MESHCORE_CONFIG, MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';
import type { ObservedNode } from '@/lib/models';

export function ProtocolBadge({ node }: { node: Pick<ObservedNode, 'protocol' | 'node_id_str'> }) {
  const isMeshCore = node.protocol === 2 || node.node_id_str?.toLowerCase().startsWith('mc:');
  const label = isMeshCore ? MESHCORE_CONFIG.labels.section : MESHTASTIC_CONFIG.labels.section;
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {label}
    </Badge>
  );
}
