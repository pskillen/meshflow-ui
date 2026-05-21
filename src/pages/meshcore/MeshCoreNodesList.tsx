import { Suspense } from 'react';
import { ProtocolNodesPage } from '@/pages/protocol/ProtocolNodesPage';
import { MESHCORE_CONFIG } from '@/lib/mesh-protocol';

export function MeshCoreNodesList() {
  return (
    <Suspense fallback={<div>Loading MeshCore nodes…</div>}>
      <ProtocolNodesPage config={MESHCORE_CONFIG} />
    </Suspense>
  );
}
