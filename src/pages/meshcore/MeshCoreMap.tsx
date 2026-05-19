import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NodesMap } from '@/components/nodes/NodesMap';
import { useMeshCoreManagedNodesSuspense, useMeshCoreNodesSuspense } from '@/hooks/api/useMeshCore';
import { subDays } from 'date-fns';
import { Suspense, useMemo } from 'react';

function MeshCoreMapContent() {
  const lastHeardAfter = useMemo(() => subDays(new Date(), 30), []);
  const { nodes } = useMeshCoreNodesSuspense({ pageSize: 500, lastHeardAfter });
  const { feeders } = useMeshCoreManagedNodesSuspense({ pageSize: 200 });

  const nodesWithPosition = useMemo(
    () => nodes.filter((n) => n.latest_position?.latitude != null && n.latest_position?.longitude != null),
    [nodes]
  );

  const feedersWithPosition = feeders.filter((f) => f.position?.latitude != null && f.position?.longitude != null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>MeshCore map</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Observed MeshCore nodes with a known position (from ADVERT). Feeders with a default location are listed
            below.
          </p>
          <div className="h-[480px] w-full">
            <NodesMap nodes={nodesWithPosition} showMapLegend />
          </div>
          {feedersWithPosition.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Feeders (default location)</h3>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {feedersWithPosition.map((f) => (
                  <li key={f.meshtastic_node_id}>
                    {f.long_name || f.node_id_str} — {f.position.latitude?.toFixed(4)},{' '}
                    {f.position.longitude?.toFixed(4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MeshCoreMap() {
  return (
    <Suspense fallback={<div>Loading MeshCore map…</div>}>
      <MeshCoreMapContent />
    </Suspense>
  );
}
