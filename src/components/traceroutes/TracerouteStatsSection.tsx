import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartCard } from '@/components/stats/ChartCard';
import { StatTile } from '@/components/stats/StatTile';
import { TrendChart } from '@/components/stats/TrendChart';
import { BarList, type BarListRow } from '@/components/traceroutes/BarList';
import { useTracerouteStats } from '@/hooks/api/useTraceroutes';
import { bucketPhrase } from '@/lib/stats-trend';
import type { StatsRange } from '@/hooks/useStatsRange';
import { buildStrategySuccessBarChartData } from '@/lib/traceroute-strategy-success-chart';
import { buildOutcomeTrend, wantsHourlyOutcomes } from '@/lib/traceroute-stats-trend';

const SOURCE_LABELS: Record<string, string> = {
  '1': 'User',
  '2': 'External',
  '3': 'Monitoring',
  '4': 'Node watch',
  '5': 'DX watch',
  // Legacy string keys if any cached responses still return slugs
  auto: 'Monitoring',
  user: 'User',
  external: 'External',
  monitor: 'Node watch',
};

/** Min number of attempts before a target is ranked. One-off 1/1 perfect runs would otherwise dominate. */
export const TOP_TARGETS_MIN_ATTEMPTS = 5;

/** Bars shown per card; the table behind "Show table" has the rest. */
const BAR_LIMIT = 6;
const TARGET_BAR_LIMIT = 6;
const TARGET_TABLE_LIMIT = 25;

const COMPLETED_COLOR = 'hsl(var(--chart-2))';
const FAILED_COLOR = 'hsl(var(--chart-5))';

const OUTCOME_SERIES = [
  { key: 'completed', label: 'Completed', color: COMPLETED_COLOR },
  { key: 'failed', label: 'Failed', color: FAILED_COLOR },
];

export type TracerouteStatsSectionProps = {
  /** When set, stats are limited to traceroutes from this source mesh node id (the page's feeder filter). */
  sourceNodeId?: number | null;
  /** The page's range (`useStatsRange()`): its key picks hourly or daily data, its window starts the query. */
  range: Pick<StatsRange, 'key' | 'longLabel' | 'window'>;
};

const plural = (n: number, noun: string) => `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;

const pct = (rate: number | null | undefined) => (rate != null ? `${(rate * 100).toFixed(0)}%` : '—');

export function TracerouteStatsSection({ sourceNodeId = null, range }: TracerouteStatsSectionProps) {
  const { data, isLoading, error } = useTracerouteStats({
    triggeredAtAfter: range.window.start,
    sourceNodeId,
    bucket: wantsHourlyOutcomes(range.key) ? '1h' : undefined,
  });

  const trend = useMemo(
    () => buildOutcomeTrend(data?.success_over_time, range.key, range.window),
    [data?.success_over_time, range.key, range.window]
  );

  const completed = data?.success_failure?.find((s) => s.status === 'completed')?.count ?? 0;
  const failed = data?.success_failure?.find((s) => s.status === 'failed')?.count ?? 0;
  const finished = completed + failed;
  const reached = (data?.by_target ?? []).filter((t) => t.completed > 0).length;

  const sourceScopeHint = useMemo(() => {
    if (sourceNodeId == null || isLoading) return null;
    const row = data?.by_source?.find((r) => r.meshtastic_node_id === sourceNodeId);
    if (!row) return 'Stats scoped to the selected source node.';
    return `Stats scoped to source ${row.short_name ?? row.node_id_str ?? sourceNodeId}.`;
  }, [sourceNodeId, isLoading, data?.by_source]);

  const strategies = useMemo(
    () => buildStrategySuccessBarChartData(data?.by_strategy_excluding_external ?? data?.by_strategy),
    [data?.by_strategy_excluding_external, data?.by_strategy]
  );
  const strategyShare = useMemo(() => {
    const all = buildStrategySuccessBarChartData(data?.by_strategy);
    const count = (s: { completed: number; failed: number; pending: number; sent: number }) =>
      s.completed + s.failed + s.pending + s.sent;
    const total = all.reduce((acc, s) => acc + count(s), 0);
    return (key: string) => {
      const row = all.find((s) => s.strategyKey === key);
      return total && row ? `${Math.round((100 * count(row)) / total)}%` : '—';
    };
  }, [data?.by_strategy]);
  const strategyBars: BarListRow[] = strategies
    .filter((s) => s.completed + s.failed + s.pending + s.sent > 0)
    .map((s) => ({
      key: s.strategyKey,
      label: s.label,
      percent: s.success_pct ?? 0,
      text: s.success_pct != null ? `${s.success_pct.toFixed(0)}% · ${s.completed + s.failed}` : '— · 0',
      spoken:
        s.success_pct != null
          ? `${s.success_pct.toFixed(0)}% success, ${plural(s.completed + s.failed, 'run')}`
          : 'No finished runs',
    }));

  const feeders = useMemo(
    () => [...(data?.by_source ?? [])].filter((r) => r.total > 0).sort((a, b) => b.total - a.total),
    [data?.by_source]
  );
  const feederBars: BarListRow[] = feeders.slice(0, BAR_LIMIT).map((r) => ({
    key: String(r.managed_node_id),
    label: r.short_name ?? r.node_id_str ?? `Node ${r.managed_node_id}`,
    percent: (r.success_rate ?? 0) * 100,
    text: `${pct(r.success_rate)} · ${r.total}`,
    spoken: `${pct(r.success_rate)} success, ${plural(r.total, 'run')}`,
  }));

  const triggers = useMemo(() => [...(data?.sources ?? [])].sort((a, b) => b.count - a.count), [data?.sources]);
  const triggerTotal = triggers.reduce((acc, s) => acc + s.count, 0);
  const triggerBars: BarListRow[] = triggers.map((s) => ({
    key: String(s.trigger_type),
    label: SOURCE_LABELS[String(s.trigger_type)] ?? String(s.trigger_type),
    percent: triggerTotal ? (100 * s.count) / triggerTotal : 0,
    text: `${triggerTotal ? Math.round((100 * s.count) / triggerTotal) : 0}% · ${s.count}`,
    spoken: `${triggerTotal ? Math.round((100 * s.count) / triggerTotal) : 0}% of runs, ${plural(s.count, 'run')}`,
  }));

  const eligibleTargets = useMemo(
    () => (data?.by_target ?? []).filter((t) => t.total >= TOP_TARGETS_MIN_ATTEMPTS && t.success_rate != null),
    [data?.by_target]
  );
  const mostReliable = useMemo(
    () => [...eligibleTargets].sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0)),
    [eligibleTargets]
  );
  const leastReliable = useMemo(() => [...mostReliable].reverse(), [mostReliable]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-destructive">
            Failed to load traceroute stats: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const noOutcomes =
    finished === 0 && trend.rows.every((r) => (Number(r.completed) || 0) + (Number(r.failed) || 0) === 0);
  const loading = <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  const dash = '…';
  const measure = `Runs per ${bucketPhrase(trend.bucket)}, by trigger time`;

  return (
    <TooltipProvider>
      <div className="space-y-4" data-testid="traceroute-stats-section">
        <div>
          <h2 className="text-lg font-semibold">Traceroute Statistics</h2>
          {sourceScopeHint ? <p className="text-xs text-muted-foreground">{sourceScopeHint}</p> : null}
        </div>

        <div role="list" className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="traceroute-stat-tiles">
          <StatTile
            role="listitem"
            hero
            label="Success rate"
            value={isLoading ? dash : finished ? `${((100 * completed) / finished).toFixed(0)}%` : '—'}
            sub={isLoading ? undefined : `${completed.toLocaleString()} of ${finished.toLocaleString()} finished`}
            data-testid="tile-success-rate"
          />
          <StatTile
            role="listitem"
            label="Runs"
            value={isLoading ? dash : finished.toLocaleString()}
            sub="completed + failed"
            data-testid="tile-runs"
          />
          <StatTile
            role="listitem"
            label="Feeders running"
            value={isLoading ? dash : feeders.length.toLocaleString()}
            sub="sent at least one"
            data-testid="tile-feeders"
          />
          <StatTile
            role="listitem"
            label="Targets probed"
            value={isLoading ? dash : (data?.by_target?.length ?? 0).toLocaleString()}
            sub={isLoading ? undefined : `${reached.toLocaleString()} reached`}
            data-testid="tile-targets"
          />
        </div>

        <ChartCard
          title="Outcomes"
          headline={isLoading ? undefined : `${finished.toLocaleString()} runs`}
          measure={measure}
          note={
            trend.fellBack
              ? 'Hourly data is not available from the server yet, so this shows UTC days.'
              : trend.bucket === 'daily' && range.key !== '30d' && range.key !== '90d'
                ? 'Traceroutes are counted per UTC day beyond 24 hours. Partial days are faded.'
                : undefined
          }
          data-testid="traceroute-outcomes-card"
        >
          {isLoading ? (
            loading
          ) : noOutcomes ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No runs in this period</p>
          ) : (
            <TrendChart
              kind="bar"
              rows={trend.rows}
              series={OUTCOME_SERIES}
              window={trend.window}
              bucket={trend.bucket}
              label={`Outcomes, ${range.longLabel}`}
              headline={`${finished.toLocaleString()} runs`}
            />
          )}
        </ChartCard>

        <div className="grid gap-4 md:grid-cols-2">
          <TableCard
            title="By strategy"
            measure="Success rate · finished runs"
            testId="traceroute-by-strategy-card"
            isLoading={isLoading}
            bars={
              <BarList
                label="Success rate by strategy"
                rows={strategyBars}
                emptyMessage="No runs with a recorded strategy."
              />
            }
            table={
              <SimpleTable
                head={[
                  'Strategy',
                  'Total',
                  'Completed',
                  'Failed',
                  'Pending',
                  'In flight',
                  'Success',
                  'Share of all runs',
                ]}
                rows={strategies.map((s) => [
                  s.label,
                  s.completed + s.failed + s.pending + s.sent,
                  s.completed,
                  s.failed,
                  s.pending,
                  s.sent,
                  s.success_pct != null ? `${s.success_pct.toFixed(0)}%` : '—',
                  strategyShare(s.strategyKey),
                ])}
              />
            }
            note="External mesh reports are left out here: they do not select a hypothesis. Runs with no recorded strategy are Legacy. Share of all runs counts external reports too."
          />

          <TableCard
            title="By feeder"
            measure={`Success rate · runs (top ${BAR_LIMIT})`}
            testId="traceroute-by-feeder-card"
            isLoading={isLoading}
            bars={<BarList label="Success rate by feeder" rows={feederBars} />}
            table={<SourceTable rows={feeders} />}
          />

          <TableCard
            title="Most reliable targets"
            measure={`Success rate · runs (${TOP_TARGETS_MIN_ATTEMPTS} or more)`}
            testId="traceroute-top-targets-card"
            isLoading={isLoading}
            bars={
              <BarList
                label="Most reliable targets"
                rows={targetBars(mostReliable.slice(0, TARGET_BAR_LIMIT))}
                emptyMessage={`No targets with at least ${TOP_TARGETS_MIN_ATTEMPTS} attempts.`}
              />
            }
            table={<TargetTable rows={mostReliable.slice(0, TARGET_TABLE_LIMIT)} />}
          />

          <TableCard
            title="Least reliable targets"
            measure={`Success rate · runs (${TOP_TARGETS_MIN_ATTEMPTS} or more)`}
            testId="traceroute-least-targets-card"
            isLoading={isLoading}
            bars={
              <BarList
                label="Least reliable targets"
                rows={targetBars(leastReliable.slice(0, TARGET_BAR_LIMIT))}
                color="hsl(var(--chart-5))"
                emptyMessage={`No targets with at least ${TOP_TARGETS_MIN_ATTEMPTS} attempts.`}
              />
            }
            table={<TargetTable rows={leastReliable.slice(0, TARGET_TABLE_LIMIT)} />}
          />

          <TableCard
            title="By trigger"
            measure="Share of runs · runs"
            testId="traceroute-by-trigger-card"
            isLoading={isLoading}
            bars={<BarList label="Runs by trigger" rows={triggerBars} color="hsl(var(--chart-3))" />}
            table={
              <SimpleTable
                head={['Trigger', 'Runs', 'Share']}
                rows={triggers.map((s) => [
                  SOURCE_LABELS[String(s.trigger_type)] ?? String(s.trigger_type),
                  s.count,
                  `${triggerTotal ? Math.round((100 * s.count) / triggerTotal) : 0}%`,
                ])}
              />
            }
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

interface TargetRow {
  meshtastic_node_id: number;
  node_id_str: string;
  short_name: string | null;
  total: number;
  completed: number;
  failed: number;
  success_rate: number | null;
}

function targetBars(rows: TargetRow[]): BarListRow[] {
  return rows.map((r) => ({
    key: String(r.meshtastic_node_id),
    label: r.short_name ?? r.node_id_str,
    percent: (r.success_rate ?? 0) * 100,
    text: `${pct(r.success_rate)} · ${r.completed + r.failed}`,
    spoken: `${pct(r.success_rate)} success, ${plural(r.completed + r.failed, 'run')}`,
    href: `/traceroutes/history?target_node=${r.meshtastic_node_id}`,
  }));
}

/** A card of bars with the full table behind a toggle, so nothing the old pies showed is lost. */
function TableCard({
  title,
  measure,
  testId,
  isLoading,
  bars,
  table,
  note,
}: {
  title: string;
  measure: string;
  testId: string;
  isLoading: boolean;
  bars: ReactNode;
  table: ReactNode;
  note?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ChartCard
      title={title}
      measure={measure}
      data-testid={testId}
      note={note}
      actions={
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="h-8 rounded-md border px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:py-1"
        >
          {open ? 'Hide table' : 'Show table'}
        </button>
      }
    >
      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          <div className="px-3 sm:px-0">{bars}</div>
          {open ? <div className="rounded-md border overflow-x-auto">{table}</div> : null}
        </div>
      )}
    </ChartCard>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head.map((h, i) => (
            <TableHead key={h} className={i === 0 ? undefined : 'text-right tabular-nums'}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={String(r[0])}>
            {r.map((c, i) => (
              <TableCell key={i} className={i === 0 ? undefined : 'text-right tabular-nums'}>
                {typeof c === 'number' ? c.toLocaleString() : c}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SourceTable({
  rows,
}: {
  rows: {
    managed_node_id: string;
    node_id_str: string;
    short_name: string;
    total: number;
    completed: number;
    failed: number;
    success_rate: number | null;
  }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead className="text-right tabular-nums">Total</TableHead>
          <TableHead className="text-right tabular-nums">Completed</TableHead>
          <TableHead className="text-right tabular-nums">Failed</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center justify-end gap-1">
              Success rate
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex"
                    aria-label="Success rate definition"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-left" side="top">
                  Completed ÷ (completed + failed) for this period. If there are no finished runs, rate is shown as —.
                  Pending and sent runs count toward Total only.
                </TooltipContent>
              </Tooltip>
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.managed_node_id}>
            <TableCell>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate" title={row.short_name}>
                  {row.short_name}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate" title={row.node_id_str}>
                  {row.node_id_str}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.total}</TableCell>
            <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
            <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
            <TableCell className="text-right tabular-nums">{pct(row.success_rate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TargetTable({ rows }: { rows: TargetRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">No targets with at least {TOP_TARGETS_MIN_ATTEMPTS} attempts.</p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Target</TableHead>
          <TableHead className="text-right tabular-nums">Attempts</TableHead>
          <TableHead className="text-right tabular-nums">Success rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.meshtastic_node_id}>
            <TableCell>
              <Link
                to={`/traceroutes/history?target_node=${row.meshtastic_node_id}`}
                className="flex flex-col gap-0.5 min-w-0 hover:underline"
              >
                <span className="font-medium truncate" title={row.short_name ?? row.node_id_str}>
                  {row.short_name ?? row.node_id_str}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate" title={row.node_id_str}>
                  {row.node_id_str}
                </span>
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.completed + row.failed}</TableCell>
            <TableCell className="text-right tabular-nums">{pct(row.success_rate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
