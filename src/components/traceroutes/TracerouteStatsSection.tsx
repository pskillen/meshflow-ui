import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { subHours, subDays } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useTracerouteStats } from '@/hooks/api/useTraceroutes';
import { strategyLabel } from '@/lib/traceroute-strategy';
import {
  buildStrategySuccessBarChartData,
  type StrategySuccessBarChartRow,
} from '@/lib/traceroute-strategy-success-chart';

const TR_STATS_TIMEFRAME_OPTIONS = [
  { key: '24h', label: '24 hours' },
  { key: '48h', label: '48 hours' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: '30d', label: '30 days' },
  { key: '60d', label: '60 days' },
  { key: '90d', label: '90 days' },
] as const;

type TimeframeKey = (typeof TR_STATS_TIMEFRAME_OPTIONS)[number]['key'];

function getTriggeredAtAfter(timeframe: TimeframeKey): Date {
  if (timeframe === '24h') return subHours(new Date(), 24);
  if (timeframe === '48h') return subHours(new Date(), 48);
  if (timeframe === '7d') return subDays(new Date(), 7);
  if (timeframe === '14d') return subDays(new Date(), 14);
  if (timeframe === '30d') return subDays(new Date(), 30);
  if (timeframe === '60d') return subDays(new Date(), 60);
  if (timeframe === '90d') return subDays(new Date(), 90);
  return subDays(new Date(), 14);
}

/** Muted overlay colour for failed segment on stacked bars (same hue family, translucent). */
function withChartFillAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

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

// Min number of attempts before a target is included in top/least success rankings.
// One-off 1/1 perfect runs would otherwise dominate the "top" list.
const TOP_TARGETS_MIN_ATTEMPTS = 5;

// Max distinct slices to show in "by node" pie charts before grouping into "Other".
const PIE_TOP_N = 7;

export type TracerouteStatsSectionProps = {
  /** When set, stats (including this chart) are limited to traceroutes from this source mesh node id. */
  sourceNodeId?: number | null;
};

export function TracerouteStatsSection({ sourceNodeId = null }: TracerouteStatsSectionProps) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('14d');
  const triggeredAtAfter = useMemo(() => getTriggeredAtAfter(timeframe), [timeframe]);

  const { data, isLoading, error } = useTracerouteStats({ triggeredAtAfter, sourceNodeId });

  const sourcesChartData = useMemo(() => {
    if (!data?.sources?.length) return [];
    return data.sources.map((s, idx) => ({
      name: SOURCE_LABELS[String(s.trigger_type)] ?? String(s.trigger_type),
      value: s.count,
      fill: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [data?.sources]);

  const strategyMixChartData = useMemo(() => {
    const raw = data?.by_strategy;
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw)
      .map(([key, counts], idx) => {
        const total = counts.completed + counts.failed + counts.pending + counts.sent;
        return {
          name: strategyLabel(key),
          value: total,
          fill: CHART_COLORS[idx % CHART_COLORS.length],
        };
      })
      .filter((d) => d.value > 0);
  }, [data?.by_strategy]);

  const strategySuccessBarRows = useMemo(
    () =>
      buildStrategySuccessBarChartData(data?.by_strategy_excluding_external ?? data?.by_strategy).map((r, idx) => {
        const fill = CHART_COLORS[idx % CHART_COLORS.length];
        return {
          ...r,
          fill,
          failedFill: withChartFillAlpha(fill, 0.4),
        };
      }),
    [data?.by_strategy_excluding_external, data?.by_strategy]
  );

  const timeframeLabel = TR_STATS_TIMEFRAME_OPTIONS.find((o) => o.key === timeframe)?.label ?? timeframe;

  const sourceScopeHint = useMemo(() => {
    if (sourceNodeId == null || !data?.by_source?.length) return null;
    const row = data.by_source.find((r) => r.node_id === sourceNodeId);
    if (!row) return 'Stats scoped to the selected source node.';
    return `Stats scoped to source ${row.short_name ?? row.node_id_str ?? sourceNodeId}.`;
  }, [sourceNodeId, data?.by_source]);

  const sentByNodeChartData = useMemo(() => {
    const rows = data?.by_source ?? [];
    if (rows.length === 0) return [];
    const sorted = [...rows].sort((a, b) => b.total - a.total).filter((r) => r.total > 0);
    const top = sorted.slice(0, PIE_TOP_N);
    const rest = sorted.slice(PIE_TOP_N);
    const otherTotal = rest.reduce((acc, r) => acc + r.total, 0);
    const slices = top.map((r, idx) => ({
      name: r.short_name ?? r.node_id_str ?? `Node ${r.managed_node_id}`,
      value: r.total,
      fill: CHART_COLORS[idx % CHART_COLORS.length],
    }));
    if (otherTotal > 0) {
      slices.push({
        name: `Other (${rest.length})`,
        value: otherTotal,
        fill: '#9ca3af',
      });
    }
    return slices;
  }, [data?.by_source]);

  const successFailureChartData = useMemo(() => {
    if (!data?.success_failure?.length) return [];
    return data.success_failure.map((s) => ({
      name: s.status === 'completed' ? 'Success' : 'Failed',
      value: s.count,
      fill: s.status === 'completed' ? '#22c55e' : '#ef4444',
    }));
  }, [data?.success_failure]);

  const successOverTimeData = useMemo(() => {
    if (!data?.success_over_time?.length) return [];
    return data.success_over_time.map((d) => {
      const finished = d.completed + d.failed;
      const success_pct = finished > 0 ? (d.completed / finished) * 100 : null;
      return { ...d, success_pct };
    });
  }, [data?.success_over_time]);

  const lineChartConfig: ChartConfig = {
    completed: { color: '#22c55e', label: 'Completed' },
    failed: { color: '#ef4444', label: 'Failed' },
    success_pct: { color: '#3b82f6', label: 'Success %' },
  };

  const strategyStackChartConfig: ChartConfig = {
    completed: { label: 'Completed', color: '#22c55e' },
    failed: { label: 'Failed', color: '#94a3b8' },
  };

  const eligibleTargets = useMemo(
    () => (data?.by_target ?? []).filter((t) => t.total >= TOP_TARGETS_MIN_ATTEMPTS && t.success_rate != null),
    [data?.by_target]
  );
  const topSuccessTargets = useMemo(
    () => [...eligibleTargets].sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0)).slice(0, 5),
    [eligibleTargets]
  );
  const leastSuccessTargets = useMemo(
    () => [...eligibleTargets].sort((a, b) => (a.success_rate ?? 0) - (b.success_rate ?? 0)).slice(0, 5),
    [eligibleTargets]
  );

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Traceroute Statistics</h2>
        <Select value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeKey)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TR_STATS_TIMEFRAME_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* TR sources pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">TR Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : sourcesChartData.length > 0 ? (
              <ChartContainer config={{}} className="aspect-auto h-[180px] w-full">
                <PieChart>
                  <Pie
                    data={sourcesChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {sourcesChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltipContent formatter={(v) => [v, '']} />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Strategy mix */}
        <Card data-testid="traceroute-strategy-mix-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Strategy mix</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Share of runs by target selection hypothesis (scheduled and manual when recorded).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : strategyMixChartData.length > 0 ? (
              <ChartContainer config={{}} className="aspect-auto h-[180px] w-full">
                <PieChart>
                  <Pie
                    data={strategyMixChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {strategyMixChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltipContent formatter={(v) => [v, '']} />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Success/failure pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Success / Failure</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : successFailureChartData.length > 0 ? (
              <ChartContainer config={{}} className="aspect-auto h-[180px] w-full">
                <PieChart>
                  <Pie
                    data={successFailureChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {successFailureChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltipContent formatter={(v) => [v, '']} />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Success over time (window matches selector + source scope) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Success over time ({timeframeLabel})</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Daily completed / failed counts (left axis) and success rate (right axis, dashed). Uses the same time
              window and source scope as the selector above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : successOverTimeData.length ? (
              <ChartContainer config={lineChartConfig} className="aspect-auto h-[180px] w-full">
                <LineChart data={successOverTimeData} margin={{ top: 4, right: 4, bottom: 20, left: 4 }}>
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
                    }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} width={28} tick={{ fontSize: 10 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 10 }}
                  />
                  <RechartsTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          if (name === 'success_pct') {
                            return [value == null ? '—' : `${(value as number).toFixed(0)}%`, ' Success rate'];
                          }
                          return [value, ` ${name === 'completed' ? 'Completed' : 'Failed'}`];
                        }}
                        labelFormatter={(l) => new Date(Number(l)).toLocaleDateString()}
                      />
                    }
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="success_pct"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2 }}
                    connectNulls
                  />
                  <Legend />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="traceroute-strategy-success-chart-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Runs by strategy</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Stacked counts: completed (solid) and failed (lighter overlay) per target selection strategy so bar height
            reflects volume. Success % in the tooltip is completed ÷ (completed + failed). Rows with no recorded
            strategy are grouped under Legacy. External mesh reports are omitted here only (they do not select a
            hypothesis). Pending and in-flight runs are not stacked; counts appear in the tooltip only.
            {sourceScopeHint ? ` ${sourceScopeHint}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <ChartContainer config={strategyStackChartConfig} className="aspect-auto h-[240px] w-full max-w-4xl">
              <BarChart
                data={strategySuccessBarRows}
                margin={{ top: 8, right: 8, left: 4, bottom: 52 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={56}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'auto']}
                  width={36}
                  tickFormatter={(v: number) => `${v}`}
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as StrategySuccessBarChartRow;
                    const finished = p.completed + p.failed;
                    const rateLine =
                      finished > 0
                        ? `${p.success_pct != null ? p.success_pct.toFixed(0) : '—'}% (${p.completed} completed / ${p.failed} failed)`
                        : `No finished runs (${p.pending} queued, ${p.sent} in flight)`;
                    return (
                      <div className="rounded-md border border-border/50 bg-background px-3 py-2 text-xs shadow-md">
                        <div className="font-medium">{p.label}</div>
                        <div className="mt-1 text-muted-foreground tabular-nums">{rateLine}</div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="completed" stackId="strategy" name="Completed" radius={[0, 0, 0, 0]}>
                  {strategySuccessBarRows.map((entry) => (
                    <Cell key={`c-${entry.strategyKey}`} fill={entry.fill} />
                  ))}
                </Bar>
                <Bar dataKey="failed" stackId="strategy" name="Failed" radius={[4, 4, 0, 0]}>
                  {strategySuccessBarRows.map((entry) => (
                    <Cell key={`f-${entry.strategyKey}`} fill={entry.failedFill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <TooltipProvider>
        <div className="grid gap-4 md:grid-cols-2">
          <TargetsRankingCard
            title="Top success targets"
            description={`Targets with the highest success rate in this period (min ${TOP_TARGETS_MIN_ATTEMPTS} attempts).`}
            isLoading={isLoading}
            rows={topSuccessTargets}
            emptyMessage={`No targets with at least ${TOP_TARGETS_MIN_ATTEMPTS} finished attempts.`}
          />
          <TargetsRankingCard
            title="Least successful targets"
            description={`Targets with the lowest success rate in this period (min ${TOP_TARGETS_MIN_ATTEMPTS} attempts).`}
            isLoading={isLoading}
            rows={leastSuccessTargets}
            emptyMessage={`No targets with at least ${TOP_TARGETS_MIN_ATTEMPTS} finished attempts.`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By source node</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Managed nodes that initiated traceroutes in this period. Success rate uses only completed and failed
                runs; pending and sent count toward Total only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading…
                </div>
              ) : data?.by_source?.length ? (
                <div className="rounded-md border overflow-x-auto">
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
                                Completed ÷ (completed + failed) for this period. If there are no finished runs, rate is
                                shown as —.
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.by_source.map((row) => (
                        <TableRow key={row.managed_node_id}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-medium truncate" title={row.short_name}>
                                {row.short_name}
                              </span>
                              <span
                                className="text-xs text-muted-foreground font-mono truncate"
                                title={row.node_id_str}
                              >
                                {row.node_id_str}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.failed}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.success_rate != null ? `${(row.success_rate * 100).toFixed(0)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                  No data
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">TRs Sent by Node</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Share of total runs per source node (top {PIE_TOP_N}, remainder grouped as “Other”).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
              ) : sentByNodeChartData.length > 0 ? (
                <ChartContainer config={{}} className="aspect-auto h-[260px] w-full">
                  <PieChart>
                    <Pie
                      data={sentByNodeChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {sentByNodeChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<ChartTooltipContent formatter={(v) => [v, '']} />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}

interface TargetRow {
  node_id: number;
  node_id_str: string;
  short_name: string | null;
  long_name: string | null;
  total: number;
  completed: number;
  failed: number;
  success_rate: number | null;
}

function TargetsRankingCard({
  title,
  description,
  isLoading,
  rows,
  emptyMessage,
}: {
  title: string;
  description: string;
  isLoading: boolean;
  rows: TargetRow[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
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
                  <TableRow key={row.node_id}>
                    <TableCell>
                      <Link
                        to={`/traceroutes/history?target_node=${row.node_id}`}
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
                    <TableCell className="text-right tabular-nums">
                      {row.success_rate != null ? `${(row.success_rate * 100).toFixed(0)}%` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
