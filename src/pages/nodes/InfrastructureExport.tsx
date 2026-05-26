import { Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { subDays, subHours } from 'date-fns';

import { useAllInfrastructureNodesSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { buildInfrastructureExportRows } from '@/lib/infrastructure-export-rows';
import { InfrastructureExportTable } from '@/components/nodes/InfrastructureExportTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type NodeListTimeRange = '2h' | '24h' | '7d' | '14d' | '30d' | 'all';

const TIME_RANGE_OPTIONS: { value: NodeListTimeRange; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function parseTimeRangeParam(param: string | null): NodeListTimeRange {
  if (param && TIME_RANGE_OPTIONS.some((o) => o.value === param)) {
    return param as NodeListTimeRange;
  }
  return 'all';
}

function getLastHeardAfter(timeRange: NodeListTimeRange): Date | undefined {
  if (timeRange === 'all') return undefined;
  const now = new Date();
  switch (timeRange) {
    case '2h':
      return subHours(now, 2);
    case '24h':
      return subHours(now, 24);
    case '7d':
      return subDays(now, 7);
    case '14d':
      return subDays(now, 14);
    case '30d':
      return subDays(now, 30);
    default:
      return undefined;
  }
}

function InfrastructureExportContent() {
  const [searchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState<NodeListTimeRange>(() =>
    parseTimeRangeParam(searchParams.get('last_heard'))
  );
  const lastHeardAfter = useMemo(() => getLastHeardAfter(timeRange), [timeRange]);

  const { nodes } = useAllInfrastructureNodesSuspense({
    lastHeardAfter,
    includeClientBase: true,
  });

  const { managedNodes } = useManagedNodesSuspense({
    pageSize: 500,
    includeStatus: true,
  });

  const managedByMeshId = useMemo(
    () =>
      new Map(
        managedNodes
          .filter((m): m is typeof m & { meshtastic_node_id: number } => m.meshtastic_node_id != null)
          .map((m) => [m.meshtastic_node_id, m])
      ),
    [managedNodes]
  );

  const exportRows = useMemo(() => buildInfrastructureExportRows(nodes, managedByMeshId), [nodes, managedByMeshId]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Infrastructure export</h1>
          <p className="text-muted-foreground mt-1">
            Filter infrastructure nodes, export CSV, or copy Meshtastic CLI commands to set favorites.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/nodes/infrastructure">← Mesh Infrastructure</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <label htmlFor="export-time-range" className="text-sm text-muted-foreground">
            Last heard:
          </label>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as NodeListTimeRange)}>
            <SelectTrigger className="w-[180px]" id="export-time-range" aria-label="Select time range">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <InfrastructureExportTable rows={exportRows} />
    </div>
  );
}

export function InfrastructureExport() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center min-h-[40vh] items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      }
    >
      <InfrastructureExportContent />
    </Suspense>
  );
}
