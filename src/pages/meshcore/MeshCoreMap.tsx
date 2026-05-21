import { Suspense } from 'react';
import { ProtocolMapPage } from '@/pages/protocol/ProtocolMapPage';
import { MESHCORE_CONFIG } from '@/lib/mesh-protocol';

export function MeshCoreMap() {
  return (
    <Suspense fallback={<div>Loading MeshCore map…</div>}>
      <ProtocolMapPage config={MESHCORE_CONFIG} />
    </Suspense>
  );
}
