import { ProtocolMessageHistoryPage } from '@/pages/protocol/ProtocolMessageHistoryPage';
import { MESHCORE_CONFIG } from '@/lib/mesh-protocol';

export function MeshCoreMessages() {
  return <ProtocolMessageHistoryPage config={MESHCORE_CONFIG} />;
}
