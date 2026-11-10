import * as React from 'react';
import { subDays } from 'date-fns';
import { useStatsSnapshots } from '@/hooks/api/useStatsSnapshots';
import { ChartCard } from '@/components/stats/ChartCard';
import { TrendChart } from '@/components/stats/TrendChart';
import type { StatsRange } from '@/hooks/useStatsRange';
import { ADOPTION_SPLIT_LOOKBACK_DAYS, buildFirmwareAdoption, buildFirmwareTrend } from '@/lib/firmware-adoption';
import { globalSnapshotRows } from '@/lib/stats-aggregation';

const TITLE = 'Firmware adoption';
const UNKNOWN_NOTE = "Unknown means we have no evidence, for example we haven't heard the node's key.";
const TREND_MEASURE = 'Trend: daily snapshot, follows the range';
const nf = new Intl.NumberFormat('en-GB');

/** The note follows the labels on screen: the "+" label (if any) is whichever generation is currently highest. */
function buildNote(labels: string[]): string {
  const plus = labels.find((l) => l.endsWith('+'));
  return plus ? `${plus} means that generation or later was identified. ${UNKNOWN_NOTE}` : UNKNOWN_NOTE;
}

function formatPercent(percent: number): string {
  return percent > 0 && percent < 1 ? '<1%' : `${percent.toFixed(0)}%`;
}

/** "last 7d" / "last 36h": the window the snapshot's counts cover. */
function describeWindow(windowHours: number | null): string {
  if (!windowHours) return 'recently';
  return windowHours % 24 === 0 ? `last ${windowHours / 24}d` : `last ${windowHours}h`;
}

export interface FirmwareAdoptionCardProps {
  /** The dashboards' range. It sets the trend only; the split is always the latest snapshot. */
  range: StatsRange;
}

export function FirmwareAdoptionCard({ range }: FirmwareAdoptionCardProps) {
  const startMs = range.window.start.getTime();
  const endMs = range.window.end.getTime();

  // One request serves both: it reaches back to the range start, or three days if that is nearer, so the split
  // always has a snapshot to read even on a 24h range.
  const { data, isLoading, error } = useStatsSnapshots({
    statType: 'node_firmware',
    constellationId: -1,
    recordedAtAfter: new Date(Math.min(startMs, subDays(new Date(endMs), ADOPTION_SPLIT_LOOKBACK_DAYS).getTime())),
    recordedAtBefore: new Date(endMs),
    page_size: 1000,
  });

  const adoption = React.useMemo(() => buildFirmwareAdoption(globalSnapshotRows(data)), [data]);
  const trend = React.useMemo(
    () => buildFirmwareTrend(adoption, { start: new Date(startMs), end: new Date(endMs) }),
    [adoption, startMs, endMs]
  );
  const trendSeries = React.useMemo(
    () => adoption.series.map((s) => ({ key: s.id, label: s.label, color: s.color })),
    [adoption.series]
  );

  if (isLoading) {
    return (
      <ChartCard title={TITLE} measure="Loading…" data-testid="firmware-adoption-card">
        <div className="h-[150px] w-full animate-pulse rounded bg-muted/50" />
      </ChartCard>
    );
  }

  if (error) {
    return (
      <ChartCard title={TITLE} measure="Failed to load" data-testid="firmware-adoption-card">
        <p className="text-destructive">{error.message}</p>
      </ChartCard>
    );
  }

  if (adoption.series.length === 0 || adoption.total === 0) {
    return (
      <ChartCard title={TITLE} data-testid="firmware-adoption-card">
        <div className="flex h-[120px] items-center justify-center rounded-md bg-muted">
          <p className="text-muted-foreground">No firmware data yet</p>
        </div>
      </ChartCard>
    );
  }

  const windowText = describeWindow(adoption.windowHours);
  const days = trend.rows.length;
  const sparse = days < 3 ? ` Only ${days} daily ${days === 1 ? 'snapshot' : 'snapshots'} in this range.` : '';

  return (
    <ChartCard
      title={TITLE}
      headline={`${nf.format(adoption.total)} nodes`}
      measure={`Split: nodes heard in the ${windowText} · ${TREND_MEASURE}`}
      note={`${buildNote(adoption.series.map((s) => s.label))}${sparse}`}
      data-testid="firmware-adoption-card"
    >
      <div className="grid items-center gap-4 md:grid-cols-[minmax(240px,1fr)_2fr] md:gap-6">
        <div className="space-y-2.5">
          {/* The stacked bar is the graphic for the split; phones get the counts only. */}
          <div
            className="hidden h-3 w-full gap-0.5 md:flex"
            role="img"
            aria-label={`Firmware split, nodes heard in the ${windowText}: ${adoption.pie
              .map((s) => `${s.label} ${formatPercent(s.percent)}`)
              .join(', ')}`}
            data-testid="firmware-split-bar"
          >
            {adoption.pie.map((s) => (
              <div
                key={s.id}
                className="first:rounded-l last:rounded-r"
                style={{ width: `${s.percent}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 md:block md:space-y-1" aria-label="Firmware breakdown">
            {adoption.pie.map((slice) => (
              <li key={slice.id} className="flex items-center justify-between gap-2 text-sm md:gap-4">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  <span className="font-medium">{slice.label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {slice.count} · {formatPercent(slice.percent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <TrendChart
          kind="line"
          rows={trend.rows}
          series={trendSeries}
          window={trend.window}
          bucket="daily"
          syncId="mesh-stats"
          height={150}
          dots
          label={`Firmware adoption, ${range.longLabel}`}
        />
      </div>
    </ChartCard>
  );
}
