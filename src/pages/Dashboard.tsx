import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Suspense, useMemo } from 'react';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { MeshStatsSection } from '@/components/MeshStatsSection';
import { RightNowBand } from '@/components/stats/RightNowBand';
import { Link } from 'react-router-dom';

function DashboardContent() {
  const { managedNodes } = useManagedNodesSuspense({ includeStatus: true });
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6" data-testid="dashboard-recently-active-nodes">
        <RightNowBand scope="both" />
      </div>
      <div className="px-4 lg:px-6" data-testid="dashboard-meshflow-map">
        <Card>
          <CardHeader>
            <CardTitle>Meshflow Map</CardTitle>
            <p className="text-sm text-muted-foreground">
              Constellations represent local regions on the mesh. Below is a map of nodes which report into Meshflow.
              Click on a node to view more information. View the <Link to="nodes">Nodes page</Link> for a list.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] w-full">
              <NodesAndConstellationsMap
                managedNodes={managedNodesForMap}
                showConstellation={true}
                showUnmanagedNodes={false}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="px-4 lg:px-6">
        <MeshStatsSection protocolScope="both" />
      </div>
    </div>
  );
}

export function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
