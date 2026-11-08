import * as React from 'react';
import { Cell, Line, LineChart, Pie, PieChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { useStatsSnapshots } from '@/hooks/api/useStatsSnapshots';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ADOPTION_HISTORY_DAYS, buildFirmwareAdoption } from '@/lib/firmware-adoption';
import { globalSnapshotRows } from '@/lib/stats-aggregation';

const TITLE = 'Firmware adoption';
const UNKNOWN_NOTE = "Unknown means we have no evidence, for example we haven't heard the node's key.";

/** The note follows the labels on screen: the "+" label (if any) is whichever generation is currently highest. */
function buildNote(labels: string[]): string {
  const plus = labels.find((l) => l.endsWith('+'));
  return plus ? `${plus} means that generation or later was identified. ${UNKNOWN_NOTE}` : UNKNOWN_NOTE;
}

function formatPercent(percent: number): string {
  return percent > 0 && percent < 1 ? '<1%' : `${percent.toFixed(0)}%`;
}

function describeWindow(windowHours: number | null): string {
  if (!windowHours) return 'Nodes heard recently';
  if (windowHours % 24 === 0) {
    const days = windowHours / 24;
    return `Nodes heard in the last ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `Nodes heard in the last ${windowHours} hours`;
}

export function FirmwareAdoptionCard() {
  const range = React.useMemo(() => {
    const end = new Date();
    return { recordedAtAfter: subDays(end, ADOPTION_HISTORY_DAYS), recordedAtBefore: end };
  }, []);

  const { data, isLoading, error } = useStatsSnapshots({
    statType: 'node_firmware',
    constellationId: -1,
    recordedAtAfter: range.recordedAtAfter,
    recordedAtBefore: range.recordedAtBefore,
    page_size: 1000,
  });

  const adoption = React.useMemo(() => buildFirmwareAdoption(globalSnapshotRows(data)), [data]);

  const config = React.useMemo<ChartConfig>(
    () => Object.fromEntries(adoption.series.map((s) => [s.id, { label: s.label, color: s.color }])),
    [adoption.series]
  );

  if (isLoading) {
    return (
      <Card data-testid="firmware-adoption-card">
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center bg-muted rounded-md">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="firmware-adoption-card">
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>Failed to load</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (adoption.series.length === 0 || adoption.total === 0) {
    return (
      <Card data-testid="firmware-adoption-card">
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center rounded-md bg-muted">
            <p className="text-muted-foreground">No firmware data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="firmware-adoption-card">
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        <CardDescription>{describeWindow(adoption.windowHours)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ChartContainer className="aspect-auto h-[250px] w-full" config={config}>
            <PieChart>
              <Pie
                data={adoption.pie}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {adoption.pie.map((slice) => (
                  <Cell key={slice.id} fill={slice.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
            </PieChart>
          </ChartContainer>

          <ChartContainer className="aspect-auto h-[250px] w-full" config={config}>
            <LineChart data={adoption.line} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(ts: number) => format(new Date(ts), 'MMM d')}
              />
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={(_, p) => format(new Date(p?.[0]?.payload?.timestamp), 'PP')} />
                }
              />
              <ChartLegend
                verticalAlign="bottom"
                content={() => (
                  <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs">
                    {adoption.series.map((s) => (
                      <li key={s.id} className="flex items-center gap-1.5">
                        <svg width="20" height="8" aria-hidden>
                          <line
                            x1="0"
                            y1="4"
                            x2="20"
                            y2="4"
                            stroke={s.color}
                            strokeWidth="2"
                            strokeDasharray={s.dashed ? '4 3' : undefined}
                          />
                        </svg>
                        <span>{s.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              />
              {adoption.series.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  dot={{ r: 3, fill: s.color, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>

        <ul className="space-y-1" aria-label="Firmware breakdown">
          {adoption.pie.map((slice) => (
            <li key={slice.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} aria-hidden />
                <span className="font-medium">{slice.label}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {slice.count} ({formatPercent(slice.percent)})
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">{buildNote(adoption.series.map((s) => s.label))}</p>
      </CardContent>
    </Card>
  );
}
