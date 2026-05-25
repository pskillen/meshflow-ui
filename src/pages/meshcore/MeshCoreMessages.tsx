import { ProtocolMessageHistoryPage } from '@/pages/protocol/ProtocolMessageHistoryPage';
import { MESHCORE_CONFIG } from '@/lib/mesh-protocol';

export function MeshCoreMessages() {
  return <ProtocolMessageHistoryPage key={MESHCORE_CONFIG.slug} config={MESHCORE_CONFIG} />;
}
