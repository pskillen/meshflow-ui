import { MeshStatsSection } from '@/components/MeshStatsSection';
import { RightNowBand } from '@/components/stats/RightNowBand';
import { Suspense } from 'react';

function MeshCoreDashboardContent() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <div data-testid="meshcore-dashboard-recent-counts">
        <RightNowBand scope="meshcore" />
      </div>
      <MeshStatsSection protocolScope="meshcore" />
    </div>
  );
}

export function MeshCoreDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <MeshCoreDashboardContent />
    </Suspense>
  );
}
