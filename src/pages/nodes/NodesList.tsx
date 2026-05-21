import { Suspense } from 'react';
import { ProtocolNodesPage } from '@/pages/protocol/ProtocolNodesPage';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

export function NodesList() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ProtocolNodesPage config={MESHTASTIC_CONFIG} />
    </Suspense>
  );
}
