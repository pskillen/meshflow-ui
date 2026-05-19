import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subDays, subHours } from 'date-fns';
import { CircleDashedIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ConstellationCoverageMap,
  type ConstellationMapLayerKey,
} from '@/components/traceroutes/ConstellationCoverageMap';
import { smoothedRate } from '@/components/map/coverageStyling';
import type { FeederIconDatum } from '@/components/map/FeederIconLayer';
import { useConstellations } from '@/hooks/api/useConstellations';
import { useConstellationCoverage } from '@/hooks/api/useConstellationCoverage';
import { useNodes } from '@/hooks/api/useNodes';
import { useObservedNodesHeard } from '@/hooks/api/useObservedNodesHeard';
import { observedNodesToCoverageGhosts } from '@/lib/coverageHeardGhosts';
import { cn } from '@/lib/utils';
import {
  TRACEROUTE_STRATEGIES,
  STRATEGY_META,
  createCoverageStrategiesAllSelected,
  coverageTargetStrategyQueryParam,
  coverageTargetStrategySummary,
} from '@/lib/traceroute-strategy';

type TimeRange = '24h' | '7d' | '30d';

const CONSTELLATION_LAYERS: ConstellationMapLayerKey[] = ['hex', 'dots', 'feeders', 'heard'];
const CONSTELLATION_LAYER_LABEL: Record<ConstellationMapLayerKey, string> = {
  hex: 'Hex',
  dots: 'Dots',
  feeders: 'Feeders',
  heard: 'Heard',
};

function StatsCard({
  hexCount,
  totalAttempts,
  totalSuccesses,
  meanSmoothed,
  minAttempts,
  strategySummary,
  dotCount,
  feederMarkerCount,
  heardGhostCount,
  className,
}: {
  hexCount: number;
  totalAttempts: number;
  totalSuccesses: number;
  meanSmoothed: number | null;
  minAttempts: number;
  strategySummary?: string;
  dotCount?: number;
  feederMarkerCount?: number;
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
        <div>{hexCount.toLocaleString()} hexes</div>
        {dotCount != null && (
          <div>
            {dotCount.toLocaleString()} target dots{' '}
            <span className="text-xs text-muted-foreground">(min attempts)</span>
          </div>
        )}
        {feederMarkerCount != null && <div>{feederMarkerCount.toLocaleString()} managed nodes (tower markers)</div>}
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
          <div className="mb-1 text-xs text-muted-foreground">Smoothed reliability (hex / dots)</div>
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
          <strong className="text-foreground">Hex</strong>: H3 aggregate.{' '}
          <strong className="text-foreground">Dots</strong>: each probed target (size = attempts, colour = reliability).{' '}
          <strong className="text-foreground">Tower</strong>: managed feeder position.{' '}
          <strong className="text-foreground">Heard</strong>: nodes with last_heard in the window and a position, not in
          the traceroute target list or constellation managed-node set for this view.
        </div>
      </CardContent>
    </Card>
  );
}

export function ConstellationCoveragePage() {
  const { constellationId: constellationIdParam } = useParams();
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [minAttempts, setMinAttempts] = useState<number>(3);
  const [h3Resolution, setH3Resolution] = useState<number>(6);
  const [mapLayers, setMapLayers] = useState<Record<ConstellationMapLayerKey, boolean>>({
    hex: true,
    dots: true,
    feeders: true,
    heard: false,
  });
  const [strategies, setStrategies] = useState(() => createCoverageStrategiesAllSelected());

  const { constellations, isLoading: constellationsLoading } = useConstellations(100, true);
  const { managedNodes } = useNodes({ pageSize: 500 });

  const constellationIdNum = constellationIdParam ? Number.parseInt(constellationIdParam, 10) : undefined;

  useEffect(() => {
    if (constellationIdParam) return;
    if (constellationsLoading) return;
    const first = constellations[0];
    if (!first) return;
    navigate(`/traceroutes/map/coverage/constellation/${first.id}`, { replace: true });
  }, [constellationIdParam, constellationsLoading, constellations, navigate]);

  const triggeredAtAfter = useMemo(() => {
    if (timeRange === '24h') return subHours(new Date(), 24);
    if (timeRange === '7d') return subDays(new Date(), 7);
    return subDays(new Date(), 30);
  }, [timeRange]);

  const includeTargets = mapLayers.dots || mapLayers.feeders;

  const targetStrategyParam = useMemo(() => coverageTargetStrategyQueryParam(strategies), [strategies]);
  const strategySummary = useMemo(() => coverageTargetStrategySummary(strategies), [strategies]);

  const { data, isLoading, error } = useConstellationCoverage({
    constellationId: Number.isFinite(constellationIdNum) ? constellationIdNum : undefined,
    triggeredAtAfter,
    h3Resolution,
    includeTargets,
    targetStrategy: targetStrategyParam,
  });

  const { nodes: heardObservedNodes } = useObservedNodesHeard({
    lastHeardAfter: triggeredAtAfter,
    pageSize: 500,
    enabled: mapLayers.heard && Number.isFinite(constellationIdNum),
  });

  const representedForHeard = useMemo(() => {
    const s = new Set<number>();
    for (const t of data?.targets ?? []) s.add(t.meshtastic_node_id);
    for (const f of data?.feeders ?? []) s.add(f.meshtastic_node_id);
    if (Number.isFinite(constellationIdNum)) {
      for (const m of managedNodes ?? []) {
        if (m.constellation?.id === constellationIdNum && m.meshtastic_node_id != null) s.add(m.meshtastic_node_id);
      }
    }
    return s;
  }, [data?.targets, data?.feeders, managedNodes, constellationIdNum]);

  const heardGhosts = useMemo(() => {
    if (!mapLayers.heard) return [];
    return observedNodesToCoverageGhosts(heardObservedNodes, representedForHeard);
  }, [mapLayers.heard, heardObservedNodes, representedForHeard]);

  const filteredHexes = useMemo(
    () => (data?.hexes ?? []).filter((h) => h.attempts >= minAttempts),
    [data, minAttempts]
  );

  const filteredTargets = useMemo(
    () => (data?.targets ?? []).filter((t) => t.attempts >= minAttempts),
    [data, minAttempts]
  );

  const totalAttempts = filteredHexes.reduce((acc, h) => acc + h.attempts, 0);
  const totalSuccesses = filteredHexes.reduce((acc, h) => acc + h.successes, 0);
  const meanSmoothed = filteredHexes.length
    ? filteredHexes.reduce((acc, h) => acc + smoothedRate(h.successes, h.attempts), 0) / filteredHexes.length
    : null;

  const positionedFeeders: FeederIconDatum[] = useMemo(() => {
    const list = data?.feeders ?? [];
    return list
      .filter((f) => f.lat != null && f.lng != null)
      .map((f) => ({ ...f, lat: f.lat as number, lng: f.lng as number }));
  }, [data?.feeders]);

  const feederMarkerCount = includeTargets ? positionedFeeders.length : undefined;
  const dotCount = includeTargets ? filteredTargets.length : undefined;
  const heardGhostCount = mapLayers.heard ? heardGhosts.length : undefined;

  const enabledMapLayers = CONSTELLATION_LAYERS.filter((k) => mapLayers[k]);

  return (
    <div className="flex min-h-[50vh] flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <CircleDashedIcon className="h-6 w-6 shrink-0" />
            <h1 className="text-xl font-semibold sm:text-2xl">Constellation coverage</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Combines traceroute attempts from every managed node in the selected constellation. <strong>Hexes</strong>{' '}
            group targets into H3 cells; <strong>dots</strong> show each probed target (size = attempts, colour =
            smoothed reliability). <strong>Tower markers</strong> show managed feeder positions. Filter by
            target-selection strategy to debug scheduler behaviour.
          </p>
        </div>
        <div className="flex flex-col gap-3" data-testid="constellation-coverage-filters">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="constellation-coverage-constellation">
                Constellation
              </Label>
              <Select
                value={constellationIdParam}
                onValueChange={(v) => navigate(`/traceroutes/map/coverage/constellation/${v}`)}
                disabled={constellationsLoading || constellations.length === 0}
              >
                <SelectTrigger
                  id="constellation-coverage-constellation"
                  className="min-w-[200px]"
                  aria-label="Select constellation"
                >
                  <SelectValue placeholder="Select constellation" />
                </SelectTrigger>
                <SelectContent>
                  {constellations.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="constellation-coverage-window">
                Window
              </Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger id="constellation-coverage-window" className="min-w-[140px]" aria-label="Time window">
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
              <Label className="text-xs text-muted-foreground" htmlFor="constellation-coverage-resolution">
                H3 resolution
              </Label>
              <Select value={String(h3Resolution)} onValueChange={(v) => setH3Resolution(Number.parseInt(v, 10))}>
                <SelectTrigger
                  id="constellation-coverage-resolution"
                  className="min-w-[100px]"
                  aria-label="H3 resolution"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 (~9km)</SelectItem>
                  <SelectItem value="6">6 (~3km)</SelectItem>
                  <SelectItem value="7">7 (~1.2km)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground" htmlFor="constellation-coverage-min-attempts">
                Min attempts
              </Label>
              <Input
                id="constellation-coverage-min-attempts"
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
            <div
              className="flex rounded-md border border-input bg-muted/50 p-0.5"
              data-testid="constellation-layer-pills"
            >
              {CONSTELLATION_LAYERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={mapLayers[key]}
                  aria-label={`Toggle ${CONSTELLATION_LAYER_LABEL[key]} layer`}
                  onClick={() => setMapLayers((s) => ({ ...s, [key]: !s[key] }))}
                  className={cn(
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    mapLayers[key]
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {CONSTELLATION_LAYER_LABEL[key]}
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
                  htmlFor={`constellation-strategy-${opt}`}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`constellation-strategy-${opt}`}
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
          hexCount={filteredHexes.length}
          totalAttempts={totalAttempts}
          totalSuccesses={totalSuccesses}
          meanSmoothed={meanSmoothed}
          minAttempts={minAttempts}
          strategySummary={strategySummary}
          dotCount={dotCount}
          feederMarkerCount={feederMarkerCount}
          heardGhostCount={heardGhostCount}
        />
      </div>

      <div
        className="relative flex-1 min-h-[300px] md:min-h-[calc(100dvh-16rem)]"
        data-testid="constellation-coverage-map"
      >
        <Card className="h-full min-h-[300px]">
          <CardContent className="h-full p-0">
            {error && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-destructive">
                Failed to load coverage: {error instanceof Error ? error.message : 'Unknown error'}
              </div>
            )}
            {isLoading && (
              <div className="flex h-full min-h-[300px] items-center justify-center text-muted-foreground">
                Loading coverage…
              </div>
            )}
            {!error && !isLoading && data && (
              <ConstellationCoverageMap
                hexes={filteredHexes}
                targets={filteredTargets}
                feeders={positionedFeeders}
                heardGhosts={heardGhosts}
                enabledLayers={enabledMapLayers}
                minAttempts={minAttempts}
              />
            )}
          </CardContent>
        </Card>

        <div className="absolute right-4 top-4 z-10 hidden md:block">
          <StatsCard
            className="w-72"
            hexCount={filteredHexes.length}
            totalAttempts={totalAttempts}
            totalSuccesses={totalSuccesses}
            meanSmoothed={meanSmoothed}
            minAttempts={minAttempts}
            strategySummary={strategySummary}
            dotCount={dotCount}
            feederMarkerCount={feederMarkerCount}
            heardGhostCount={heardGhostCount}
          />
        </div>
      </div>
    </div>
  );
}
