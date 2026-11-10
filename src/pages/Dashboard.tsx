import { NodesAndConstellationsMap } from '@/components/nodes/NodesAndConstellationsMap';
import { useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import { MeshStatsSection } from '@/components/MeshStatsSection';
import { RightNowBand } from '@/components/stats/RightNowBand';
import { StatsRangeBar } from '@/components/stats/StatsRangeBar';
import { DASHBOARDS_AREA, useStatsRange } from '@/hooks/useStatsRange';
import { Link } from 'react-router-dom';

const PHONE_QUERY = '(max-width: 767px)';

/** True below the `md` breakpoint. Reads the media query on first render, so a phone never mounts the map first. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia?.(PHONE_QUERY).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(PHONE_QUERY);
    if (!mql) return;
    const onChange = () => setPhone(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return phone;
}

function DashboardContent() {
  const phone = usePhone();
  const [mapOpen, setMapOpen] = useState(false);
  // The map sits below the stats. On phones it starts collapsed, so it neither pushes nor loads tiles until asked.
  const showMap = !phone || mapOpen;
  const { managedNodes } = useManagedNodesSuspense({ includeStatus: true });
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(managedNodes), [managedNodes]);

  const range = useStatsRange({ area: DASHBOARDS_AREA });

  return (
    <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
      <StatsRangeBar
        value={range.key}
        options={range.options}
        onChange={range.setRange}
        title="Dashboard"
        className="px-4 lg:px-6"
      />
      <div className="px-4 lg:px-6" data-testid="dashboard-recently-active-nodes">
        <RightNowBand scope="both" />
      </div>
      <div className="px-4 lg:px-6">
        <MeshStatsSection protocolScope="both" range={range} />
      </div>
      <div className="px-4 lg:px-6" data-testid="dashboard-meshflow-map">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Meshflow Map</CardTitle>
              {phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapOpen((open) => !open)}
                  aria-expanded={showMap}
                  aria-controls="dashboard-map-body"
                  data-testid="dashboard-map-toggle"
                >
                  {showMap ? 'Hide map' : 'Show map'}
                </Button>
              )}
            </div>
            {showMap && (
              <p className="text-sm text-muted-foreground">
                Constellations represent local regions on the mesh. Below is a map of nodes which report into Meshflow.
                Click on a node to view more information. View the <Link to="nodes">Nodes page</Link> for a list.
              </p>
            )}
          </CardHeader>
          {showMap && (
            <CardContent id="dashboard-map-body">
              <div className="h-[600px] w-full">
                <NodesAndConstellationsMap
                  managedNodes={managedNodesForMap}
                  showConstellation={true}
                  showUnmanagedNodes={false}
                />
              </div>
            </CardContent>
          )}
        </Card>
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
