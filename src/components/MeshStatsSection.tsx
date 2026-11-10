import { Fragment, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartCard } from '@/components/stats/ChartCard';
import { TrendChart, type TrendSeries } from '@/components/stats/TrendChart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useStatsSnapshotsForTypesSuspense } from '@/hooks/api/useStatsSnapshots';
import type { StatsRange } from '@/hooks/useStatsRange';
import { PACKET_TYPE_DISPLAY_NAMES } from '@/lib/stats-aggregation';
import {
  MC_PACKET_TYPE_DISPLAY_NAMES,
  onlineNodesMetricStatTypes,
  packetVolumeStatTypes,
  type MeshStatsProtocolScope,
  type OnlineNodesChartMetric,
} from '@/lib/stats-snapshot-types';
import { formatTrendLabel } from '@/lib/stats-trend';
import {
  buildByTypeRows,
  buildCountRows,
  bucketPhrase,
  meanOf,
  seriesForScope,
  snapshotParamsForRange,
  totalOf,
  type CountTrend,
} from '@/lib/stats-trend-data';

const nf = new Intl.NumberFormat('en-GB');

const PACKET_TYPE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(220 70% 50%)',
  'hsl(280 60% 55%)',
];

function packetTypeSeries(labels: Record<string, string>): TrendSeries[] {
  return Object.keys(labels).map((key, i) => ({
    key,
    label: labels[key]!,
    color: PACKET_TYPE_COLORS[i % PACKET_TYPE_COLORS.length]!,
  }));
}

const SECTION_LINKS: Partial<Record<MeshStatsProtocolScope, { href: string; label: string }[]>> = {
  meshtastic: [
    { href: '/messages', label: 'Messages' },
    { href: '/nodes', label: 'Nodes' },
  ],
  meshcore: [
    { href: '/meshcore/messages', label: 'Messages' },
    { href: '/meshcore/nodes', label: 'Nodes' },
  ],
};

const SYNC_ID = 'mesh-stats';

/** The note under a chart: what the dashes mean, what is truncated, and the snapshot lag. */
function chartNote(trend: CountTrend, range: StatsRange): string {
  const parts: string[] = [];
  if (trend.hasPartial) parts.push('Faded or dashed: still in progress, or only partly covered.');
  if (trend.truncated) parts.push('The API returned only part of this range; the oldest days are missing.');
  parts.push(
    trend.latest != null && range.bucket !== 'daily'
      ? `Latest point ${formatTrendLabel(trend.latest, range.bucket)}. Snapshots trail real time by about an hour.`
      : 'Snapshots trail real time by about an hour.'
  );
  return parts.join(' ');
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <ChartCard title={title} data-testid="chart-skeleton">
      <div className="h-[190px] w-full animate-pulse rounded bg-muted/50" />
    </ChartCard>
  );
}

interface NodeChartProps {
  scope: MeshStatsProtocolScope;
  range: StatsRange;
}

/** Online nodes (line, mean per bucket) or New nodes (bars, total per bucket). */
function NodesChart({
  scope,
  range,
  metric,
  title,
  kind,
}: NodeChartProps & { metric: OnlineNodesChartMetric; title: string; kind: 'line' | 'bar' }) {
  const statTypes = useMemo(() => onlineNodesMetricStatTypes(metric, scope), [metric, scope]);
  const params = useMemo(() => snapshotParamsForRange(range.window, range.bucket), [range.window, range.bucket]);
  const pages = useStatsSnapshotsForTypesSuspense(statTypes, params);
  const series = useMemo(() => seriesForScope(scope), [scope]);
  const keys = series.map((s) => s.key);
  const trend = useMemo(
    () =>
      buildCountRows({
        pages,
        scope,
        mtStat: metric,
        mcStat: metric === 'online_nodes' ? 'mc_online_nodes' : 'mc_new_nodes',
        mode: metric === 'online_nodes' ? 'average' : 'sum',
        window: range.window,
        bucket: range.bucket,
      }),
    [pages, scope, metric, range.window, range.bucket]
  );

  const headline =
    metric === 'online_nodes' ? `avg ${nf.format(meanOf(trend.rows, keys))}` : nf.format(totalOf(trend.rows, keys));
  const measure =
    metric === 'online_nodes'
      ? `Each point: nodes heard in the 2h before it${range.bucket === 'hourly' ? '' : ` · ${range.bucketLabel} mean`}`
      : `First seen, per ${bucketPhrase(range.bucket)}`;

  return (
    <ChartCard
      title={title}
      headline={headline}
      measure={measure}
      note={chartNote(trend, range)}
      data-testid={`chart-${metric}`}
    >
      <TrendChart
        kind={kind}
        rows={trend.rows}
        series={series}
        window={range.window}
        bucket={range.bucket}
        syncId={SYNC_ID}
        label={`${title}, ${range.longLabel}`}
      />
    </ChartCard>
  );
}

/** Packet volume: total per bucket, with a Total / By type toggle on single-protocol dashboards. */
function PacketVolumeChart({ scope, range }: NodeChartProps) {
  const [view, setView] = useState<'total' | 'byType'>('total');
  const statTypes = useMemo(() => packetVolumeStatTypes(scope), [scope]);
  const params = useMemo(() => snapshotParamsForRange(range.window, range.bucket), [range.window, range.bucket]);
  const pages = useStatsSnapshotsForTypesSuspense(statTypes, params);
  const series = useMemo(() => seriesForScope(scope), [scope]);
  const keys = series.map((s) => s.key);
  const typeLabels = scope === 'meshcore' ? MC_PACKET_TYPE_DISPLAY_NAMES : PACKET_TYPE_DISPLAY_NAMES;
  const typeSeries = useMemo(() => packetTypeSeries(typeLabels), [typeLabels]);
  const canSplit = scope !== 'both';
  const byType = canSplit && view === 'byType';

  const total = useMemo(
    () =>
      buildCountRows({
        pages,
        scope,
        mtStat: 'packet_volume',
        mcStat: 'mc_packet_volume',
        mode: 'sum',
        window: range.window,
        bucket: range.bucket,
      }),
    [pages, scope, range.window, range.bucket]
  );
  const split = useMemo(
    () =>
      byType
        ? buildByTypeRows({
            page: pages[scope === 'meshcore' ? 'mc_packet_volume' : 'packet_volume'],
            window: range.window,
            bucket: range.bucket,
          })
        : null,
    [byType, pages, scope, range.window, range.bucket]
  );
  const shown = split ?? total;

  return (
    <ChartCard
      title="Packet volume"
      headline={nf.format(totalOf(total.rows, keys))}
      measure={`Packets per ${bucketPhrase(range.bucket)}${byType ? ', by packet type' : ''}`}
      note={chartNote(shown, range)}
      data-testid="chart-packet_volume"
      actions={
        canSplit ? (
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as 'total' | 'byType')}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="total" aria-label="Total packets">
              Total
            </ToggleGroupItem>
            <ToggleGroupItem value="byType" aria-label="Packets by type">
              By type
            </ToggleGroupItem>
          </ToggleGroup>
        ) : undefined
      }
    >
      <TrendChart
        kind="bar"
        rows={shown.rows}
        series={byType ? typeSeries : series}
        window={range.window}
        bucket={range.bucket}
        syncId={SYNC_ID}
        label={`Packet volume, ${range.longLabel}`}
      />
    </ChartCard>
  );
}

export interface MeshStatsSectionProps {
  protocolScope?: MeshStatsProtocolScope;
  /** The dashboards' shared range (`useStatsRange({ area: 'dashboards' })`), chosen on the page's `StatsRangeBar`. */
  range: StatsRange;
}

/** "Over the range" charts for a dashboard: Online nodes, New nodes, Packet volume. See MeshStatsSection.md. */
export function MeshStatsSection({ protocolScope = 'both', range }: MeshStatsSectionProps) {
  const links = SECTION_LINKS[protocolScope];
  return (
    <section className="space-y-2 md:space-y-3" data-testid="dashboard-mesh-stats">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm md:text-base font-semibold">Over the {range.longLabel}</h2>
        <p className="hidden text-xs text-muted-foreground md:block">
          Every chart shares this range, x-axis and hover.
        </p>
        {links?.length ? (
          <p className="text-xs text-muted-foreground">
            {links.map((link, i) => (
              <Fragment key={link.href}>
                {i > 0 ? ' · ' : ''}
                <Link to={link.href} className="underline underline-offset-2">
                  {link.label}
                </Link>
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Suspense fallback={<ChartSkeleton title="Online nodes" />}>
            <NodesChart scope={protocolScope} range={range} metric="online_nodes" title="Online nodes" kind="line" />
          </Suspense>
        </div>
        <Suspense fallback={<ChartSkeleton title="New nodes" />}>
          <NodesChart scope={protocolScope} range={range} metric="new_nodes" title="New nodes" kind="bar" />
        </Suspense>
        <Suspense fallback={<ChartSkeleton title="Packet volume" />}>
          <PacketVolumeChart scope={protocolScope} range={range} />
        </Suspense>
      </div>
    </section>
  );
}
