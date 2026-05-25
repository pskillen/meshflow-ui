import { ProtocolMessageHistoryPage } from '@/pages/protocol/ProtocolMessageHistoryPage';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

export function MessageHistory() {
  return <ProtocolMessageHistoryPage key={MESHTASTIC_CONFIG.slug} config={MESHTASTIC_CONFIG} />;
}
