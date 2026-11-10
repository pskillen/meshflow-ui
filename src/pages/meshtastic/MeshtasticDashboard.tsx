import { FirmwareAdoptionCard } from '@/components/FirmwareAdoptionCard';
import { MeshStatsSection } from '@/components/MeshStatsSection';
import { RightNowBand } from '@/components/stats/RightNowBand';
import { StatsRangeBar } from '@/components/stats/StatsRangeBar';
import { DASHBOARDS_AREA, useStatsRange } from '@/hooks/useStatsRange';
import { Suspense } from 'react';

function MeshtasticDashboardContent() {
  const range = useStatsRange({ area: DASHBOARDS_AREA });
  return (
    <div className="flex flex-col gap-4 pb-4 md:gap-6 md:pb-6">
      <StatsRangeBar
        value={range.key}
        options={range.options}
        onChange={range.setRange}
        title="Meshtastic"
        className="px-4 lg:px-6"
      />
      <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
        <div data-testid="meshtastic-dashboard-recent-counts">
          <RightNowBand scope="meshtastic" />
        </div>
        <MeshStatsSection protocolScope="meshtastic" range={range} />
        <FirmwareAdoptionCard range={range} />
      </div>
    </div>
  );
}

export function MeshtasticDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        </div>
      }
    >
      <MeshtasticDashboardContent />
    </Suspense>
  );
}
