import { MeshStatsSection } from '@/components/MeshStatsSection';
import { useRecentNodeCountsSuspense } from '@/hooks/api/useNodes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Suspense } from 'react';

const COUNT_COLUMNS = [
  { key: '2', label: '2 hours' },
  { key: '24', label: '24h' },
  { key: '168', label: '7 days' },
  { key: '720', label: '30 days' },
  { key: '2160', label: '90 days' },
  { key: 'all', label: 'All time' },
] as const;

function MeshtasticDashboardContent() {
  const counts = useRecentNodeCountsSuspense('meshtastic');

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <Card data-testid="meshtastic-dashboard-recent-counts">
        <CardHeader>
          <CardTitle>Recently active Meshtastic nodes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {COUNT_COLUMNS.map((col) => (
                  <TableHead key={col.key} className="text-center">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                {COUNT_COLUMNS.map((col) => (
                  <TableCell key={col.key} className="text-center font-mono tabular-nums">
                    {counts[col.key] ?? '—'}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <MeshStatsSection protocolScope="meshtastic" />
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
