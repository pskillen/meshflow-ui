import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { subDays, subHours } from 'date-fns';
import { CircleDashedIcon, RouteIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNodes } from '@/hooks/api/useNodes';
import { useFeederReach } from '@/hooks/api/useFeederReach';
import { useObservedNodesHeard } from '@/hooks/api/useObservedNodesHeard';
import { observedNodesToCoverageGhosts } from '@/lib/coverageHeardGhosts';
import { FeederCoverageMap, type CoverageLayerKey } from '@/components/traceroutes/FeederCoverageMap';
import {
  TRACEROUTE_STRATEGIES,
  STRATEGY_META,
  createCoverageStrategiesAllSelected,
  coverageTargetStrategyQueryParam,
  coverageTargetStrategySummary,
} from '@/lib/traceroute-strategy';

type TimeRange = '24h' | '7d' | '30d';

const ALL_LAYERS: CoverageLayerKey[] = ['dots', 'hex', 'polygon', 'heard'];
const LAYER_LABEL: Record<CoverageLayerKey, string> = {
  dots: 'Dots',
  hex: 'Hex',
  polygon: 'Polygon',
  heard: 'Heard',
};

function smoothedRate(successes: number, attempts: number): number {
  return (successes + 1) / (attempts + 2);
}

function StatsCard({
  feederLabel,
  targetCount,
  totalAttempts,
  totalSuccesses,
  meanSmoothed,
  minAttempts,
  strategySummary,
  heardGhostCount,
  className,
}: {
  feederLabel: string;
  targetCount: number;
  totalAttempts: number;
  totalSuccesses: number;
  meanSmoothed: number | null;
  minAttempts: number;
  strategySummary?: string;
  heardGhostCount?: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Coverage stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {strategySummary != null && (
          <div className="text-xs text-muted-foreground">
            Strategies: <span className="text-foreground">{strategySummary}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">{feederLabel}</div>
        <div>{targetCount.toLocaleString()} targets reached</div>
        {heardGhostCount != null && (
          <div>
            {heardGhostCount.toLocaleString()} heard-only nodes{' '}
            <span className="text-xs text-muted-foreground">(hollow markers)</span>
          </div>
        )}
        <div>
          {totalSuccesses.toLocaleString()} / {totalAttempts.toLocaleString()} attempts succeeded
        </div>
        {meanSmoothed != null && <div>Mean smoothed reliability: {(meanSmoothed * 100).toFixed(1)}%</div>}
        <div className="pt-2 text-xs text-muted-foreground">Min attempts floor: {minAttempts}</div>
        <div className="pt-2">
          <div className="mb-1 text-xs text-muted-foreground">Smoothed reliability</div>
          <div
            className="h-2 w-full rounded"
            style={{
              background: 'linear-gradient(to right, #ef4444, #f59e0b 50%, #22c55e)',
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Dots</strong>: probed targets (size = attempts).{' '}
          <strong className="text-foreground">Tower</strong>: this managed feeder (source node).{' '}
          <strong className="text-foreground">Heard</strong>: other nodes with a position and last_heard in the window,
          not in this feeder&apos;s traceroute target list for the current strategy filter.
        </div>
      </CardContent>
    </Card>
  );
}

export function FeederCoveragePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [minAttempts, setMinAttempts] = useState<number>(3);
  const [layers, setLayers] = useState<Record<CoverageLayerKey, boolean>>({
    dots: true,
    hex: false,
    polygon: false,
    heard: false,
  });
  const [strategies, setStrategies] = useState(() => createCoverageStrategiesAllSelected());

  const { managedNodes, isLoadingManagedNodes: feedersLoading } = useNodes({ pageSize: 500 });

  const feederOptions = useMemo(
    () =>
      [...(managedNodes ?? [])]
        .filter((n) => n.meshtastic_node_id != null)
        .sort((a, b) => {
          const labelA = (a.short_name || a.long_name || a.node_id_str || '').toLowerCase();
          const labelB = (b.short_name || b.long_name || b.node_id_str || '').toLowerCase();
          return labelA.localeCompare(labelB);
        }),
    [managedNodes]
  );

  const feederParam = searchParams.get('feeder');
  const feederIdFromUrl = feederParam ? Number.parseInt(feederParam, 10) : NaN;
  const [selectedFeederId, setSelectedFeederId] = useState<number | undefined>(
    Number.isFinite(feederIdFromUrl) ? feederIdFromUrl : undefined
  );

  // Promote default to the first feeder once the list loads, unless the URL has set one.
  useEffect(() => {
    if (selectedFeederId != null) return;
    if (feederOptions.length === 0) return;
    setSelectedFeederId(feederOptions[0].meshtastic_node_id);
  }, [feederOptions, selectedFeederId]);

  // Mirror selection into the URL so it's deep-linkable.
  useEffect(() => {
    if (selectedFeederId == null) return;
    const current = searchParams.get('feeder');
    if (current === String(selectedFeederId)) return;
    const next = new URLSearchParams(searchParams);
    next.set('feeder', String(selectedFeederId));
    setSearchParams(next, { replace: true });
  }, [selectedFeederId, searchParams, setSearchParams]);

  const triggeredAtAfter = useMemo(() => {
    if (timeRange === '24h') return subHours(new Date(), 24);
    if (timeRange === '7d') return subDays(new Date(), 7);
    return subDays(new Date(), 30);
  }, [timeRange]);

  const targetStrategyParam = useMemo(() => coverageTargetStrategyQueryParam(strategies), [strategies]);
  const strategySummary = useMemo(() => coverageTargetStrategySummary(strategies), [strategies]);

  const { data, isLoading, error } = useFeederReach({
    feederId: selectedFeederId,
    triggeredAtAfter,
    targetStrategy: targetStrategyParam,
  });

  const { nodes: heardObservedNodes } = useObservedNodesHeard({
    lastHeardAfter: triggeredAtAfter,
    pageSize: 500,
    enabled: layers.heard && selectedFeederId != null,
  });

  const representedForHeard = useMemo(() => {
    const s = new Set<number>();
    if (data?.feeder?.meshtastic_node_id != null) s.add(data.feeder.meshtastic_node_id);
    for (const t of data?.targets ?? []) s.add(t.meshtastic_node_id);
    return s;
  }, [data]);

  const heardGhosts = useMemo(() => {
    if (!layers.heard) return [];
    return observedNodesToCoverageGhosts(heardObservedNodes, representedForHeard);
  }, [layers.heard, heardObservedNodes, representedForHeard]);

  const filteredTargets = useMemo(
    () => (data?.targets ?? []).filter((t) => t.attempts >= minAttempts),
    [data, minAttempts]
  );

  const totalAttempts = filteredTargets.reduce((acc, t) => acc + t.attempts, 0);
  const totalSuccesses = filteredTargets.reduce((acc, t) => acc + t.successes, 0);
  const meanSmoothed = filteredTargets.length
    ? filteredTargets.reduce((acc, t) => acc + smoothedRate(t.successes, t.attempts), 0) / filteredTargets.length
    : null;

  const selectedFeeder = feederOptions.find((n) => n.meshtastic_node_id === selectedFeederId);
  const feederLabel = selectedFeeder
    ? selectedFeeder.short_name || selectedFeeder.long_name || selectedFeeder.node_id_str
    : 'Select a feeder';

  const enabledLayers = (Object.keys(layers) as CoverageLayerKey[]).filter((k) => layers[k]);

  return (
    <div className="flex min-h-[50vh] flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <CircleDashedIcon className="h-6 w-6 shrink-0" />
            <h1 className="text-xl font-semibold sm:text-2xl">Managed node coverage</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Maps completed and failed auto-traceroutes from one managed node to each probed target over the time window.
            Dots show per-target reliability; hex bins summarise nearby targets; the polygon outlines where at least one
            successful route was observed (not a guarantee of RF coverage). The selected managed node appears as an
            orange tower marker (distinct from the heatmap dots). Use the strategy checkboxes to include only
            traceroutes recorded under specific target-selection hypotheses.
          </p>
        </div>
        <div className="flex flex-col gap-3" data-testid="coverage-filters">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Label className="text-xs text-muted-foreground" htmlFor="feeder-coverage-feeder">
                Feeder
              </Label>
              <Select
                value={selectedFeederId != null ? String(selectedFeederId) : undefined}
                onValueChange={(v) => setSelectedFeederId(Number.parseInt(v, 10))}
                disabled={feedersLoading || feederOptions.length === 0}
              >
                <SelectTrigger id="feeder-coverage-feeder" className="min-w-[200px]" aria-label="Select feeder">
                  <SelectValue placeholder="Select feeder" />
                </SelectTrigger>
                <SelectContent>
                  {feederOptions.map((n) => (
                    <SelectItem key={n.meshtastic_node_id} value={String(n.meshtastic_node_id)}>
                      {n.short_name || n.long_name || n.node_id_str}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="feeder-coverage-window">
                Window
              </Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger id="feeder-coverage-window" className="min-w-[140px]" aria-label="Time window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="feeder-coverage-min-attempts">
                Min attempts
              </Label>
              <Input
                id="feeder-coverage-min-attempts"
                type="number"
                min={1}
                value={minAttempts}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  setMinAttempts(Number.isFinite(v) && v >= 1 ? v : 1);
                }}
                className="w-20"
              />
            </div>
            <div className="flex rounded-md border border-input bg-muted/50 p-0.5" data-testid="layer-pills">
              {ALL_LAYERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={layers[key]}
                  aria-label={`Toggle ${LAYER_LABEL[key]} layer`}
                  onClick={() => setLayers((s) => ({ ...s, [key]: !s[key] }))}
                  className={cn(
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    layers[key]
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {LAYER_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Target selection strategies</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {TRACEROUTE_STRATEGIES.map((opt) => (
                <label
                  key={opt}
                  htmlFor={`feeder-coverage-strategy-${opt}`}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`feeder-coverage-strategy-${opt}`}
                    checked={strategies[opt] ?? false}
                    onCheckedChange={(c) => setStrategies((s) => ({ ...s, [opt]: c === true }))}
                  />
                  <span className="leading-none">{STRATEGY_META[opt].label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="block md:hidden">
        <StatsCard
          feederLabel={feederLabel}
          targetCount={filteredTargets.length}
          totalAttempts={totalAttempts}
          totalSuccesses={totalSuccesses}
          meanSmoothed={meanSmoothed}
          minAttempts={minAttempts}
          strategySummary={strategySummary}
          heardGhostCount={layers.heard ? heardGhosts.length : undefined}
        />
      </div>

      <div className="relative flex-1 min-h-[300px] md:min-h-[calc(100dvh-16rem)]" data-testid="feeder-coverage-map">
        <Card className="h-full min-h-[300px]">
          <CardContent className="h-full p-0">
            {error && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-destructive">
                <span>Failed to load coverage: {error instanceof Error ? error.message : 'Unknown error'}</span>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/traceroutes">
                    <RouteIcon className="mr-1 h-4 w-4" /> Back to traceroute stats
                  </Link>
                </Button>
              </div>
            )}
            {isLoading && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-muted-foreground">
                Loading coverage…
              </div>
            )}
            {!error && !isLoading && data && (
              <FeederCoverageMap
                feeder={data.feeder}
                targets={filteredTargets}
                heardGhosts={heardGhosts}
                enabledLayers={enabledLayers}
                minAttempts={minAttempts}
              />
            )}
          </CardContent>
        </Card>

        <div className="absolute right-4 top-4 z-10 hidden md:block">
          <StatsCard
            className="w-72"
            feederLabel={feederLabel}
            targetCount={filteredTargets.length}
            totalAttempts={totalAttempts}
            totalSuccesses={totalSuccesses}
            meanSmoothed={meanSmoothed}
            minAttempts={minAttempts}
            strategySummary={strategySummary}
            heardGhostCount={layers.heard ? heardGhosts.length : undefined}
          />
        </div>
      </div>
    </div>
  );
}
