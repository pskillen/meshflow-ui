import { ProtocolMessageHistoryPage } from '@/pages/protocol/ProtocolMessageHistoryPage';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

export function MessageHistory() {
  return <ProtocolMessageHistoryPage config={MESHTASTIC_CONFIG} />;
}
