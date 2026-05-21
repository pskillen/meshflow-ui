import { Suspense } from 'react';
import { ProtocolMapPage } from '@/pages/protocol/ProtocolMapPage';
import { MESHTASTIC_CONFIG } from '@/lib/mesh-protocol';

export function NodeMap() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      }
    >
      <ProtocolMapPage config={MESHTASTIC_CONFIG} />
    </Suspense>
  );
}
