import { useMemo, useState, Suspense } from 'react';
import { subHours } from 'date-fns';
import { useWeatherNodesSuspense } from '@/hooks/api/useNodes';
import { useMultiNodeEnvironmentMetricsSuspense } from '@/hooks/api/useMultiNodeEnvironmentMetrics';
import { WeatherNodeCard } from '@/components/nodes/WeatherNodeCard';
import { WeatherMapAgeLegend } from '@/components/nodes/WeatherMapAgeLegend';
import { WeatherNodesMap } from '@/components/nodes/WeatherNodesMap';
import { computeVisibleWeatherTemperatureAnchors } from '@/components/nodes/weather-map-helpers';
import { TimeRangeSelect } from '@/components/TimeRangeSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CHART_TIME_RANGE_OPTIONS = [
  { key: '24h', label: '24 hours' },
  { key: '48h', label: '48 hours' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
];

type EnvCutoffRange = '2h' | '6h' | '12h' | '24h';

/** Map legend and marker fade/hide window (hours). */
const WEATHER_MAP_ENV_AGE_HOURS = 24;

const ENV_CUTOFF_OPTIONS: { value: EnvCutoffRange; label: string }[] = [
  { value: '2h', label: '2 hours' },
  { value: '6h', label: '6 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours' },
];

function getEnvironmentReportedAfter(cutoff: EnvCutoffRange): Date {
  const now = new Date();
  switch (cutoff) {
    case '2h':
      return subHours(now, 2);
    case '6h':
      return subHours(now, 6);
    case '12h':
      return subHours(now, 12);
    case '24h':
    default:
      return subHours(now, 24);
  }
}

function getChartDateRange(key: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const hours = key.endsWith('h') ? parseInt(key) || 48 : 0;
  const days = key.endsWith('d') ? parseInt(key) || 7 : 0;
  const startDate =
    days > 0 ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : new Date(now.getTime() - hours * 60 * 60 * 1000);
  return { startDate, endDate: now };
}

function WeatherContent() {
  const [envCutoff, setEnvCutoff] = useState<EnvCutoffRange>('24h');
  const [chartTimeRangeLabel, setChartTimeRangeLabel] = useState('48h');
  const [chartDateRange, setChartDateRange] = useState<{ startDate: Date; endDate: Date }>(() =>
    getChartDateRange('48h')
  );

  const environmentReportedAfter = useMemo(() => getEnvironmentReportedAfter(envCutoff), [envCutoff]);

  const { nodes, totalNodes, fetchNextPage, hasNextPage } = useWeatherNodesSuspense({
    environmentReportedAfter,
    pageSize: 100,
    weatherUse: ['include', 'unknown'],
  });

  const { metricsMap } = useMultiNodeEnvironmentMetricsSuspense(nodes, chartDateRange);

  const temperatureAnchors = useMemo(
    () => computeVisibleWeatherTemperatureAnchors(nodes, WEATHER_MAP_ENV_AGE_HOURS),
    [nodes]
  );

  const sortedNodes = useMemo(
    () =>
      [...nodes].sort((a, b) => {
        const aTime = a.latest_environment_metrics?.reported_time;
        const bTime = b.latest_environment_metrics?.reported_time;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    [nodes]
  );

  const handleChartTimeRangeChange = (value: string, timeRange: { startDate: Date; endDate: Date }) => {
    setChartTimeRangeLabel(value);
    setChartDateRange(timeRange);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Weather</h1>
        <p className="mt-1 text-muted-foreground">
          Nodes reporting environment metrics (temperature, pressure, humidity)
        </p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <label htmlFor="env-cutoff" className="text-sm text-muted-foreground">
            Show nodes with env data from:
          </label>
          <Select value={envCutoff} onValueChange={(v) => setEnvCutoff(v as EnvCutoffRange)}>
            <SelectTrigger className="w-[180px]" id="env-cutoff" aria-label="Select env cutoff">
              <SelectValue placeholder="Select cutoff" />
            </SelectTrigger>
            <SelectContent>
              {ENV_CUTOFF_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="chart-time-range" className="text-sm text-muted-foreground">
            Chart time range:
          </label>
          <TimeRangeSelect
            options={CHART_TIME_RANGE_OPTIONS}
            value={chartTimeRangeLabel}
            onChange={handleChartTimeRangeChange}
          />
        </div>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Weather Node Locations</CardTitle>
            <p className="text-sm text-muted-foreground">
              Marker fill colour reflects the latest reported temperature (cold blue → hot red, anchored on the visible
              5th / 95th percentile). The 3px border fades from transparent (fresh) to slate as the reading ages over
              24h. Older readings are hidden.
            </p>
          </CardHeader>
          <CardContent>
            <WeatherMapAgeLegend fadeHours={WEATHER_MAP_ENV_AGE_HOURS} temperatureAnchors={temperatureAnchors} />
            <div className="h-[600px] w-full">
              <WeatherNodesMap
                nodes={nodes}
                cutoffHours={WEATHER_MAP_ENV_AGE_HOURS}
                temperatureAnchors={temperatureAnchors}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            All Weather Nodes ({sortedNodes.length}
            {totalNodes > sortedNodes.length ? ` of ${totalNodes}` : ''})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNodes.map((node) => (
            <WeatherNodeCard
              key={node.internal_id}
              node={node}
              metrics={metricsMap[node.meshtastic_node_id] ?? []}
              dateRange={chartDateRange}
            />
          ))}
        </div>
        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" onClick={() => fetchNextPage()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Weather() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center min-h-screen items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <WeatherContent />
    </Suspense>
  );
}
