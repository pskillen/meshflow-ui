import * as React from 'react';
import { Cell, Line, LineChart, Pie, PieChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { useStatsSnapshots } from '@/hooks/api/useStatsSnapshots';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ADOPTION_HISTORY_DAYS, buildFirmwareAdoption } from '@/lib/firmware-adoption';
import { globalSnapshotRows } from '@/lib/stats-aggregation';

const TITLE = 'Firmware adoption';
const NOTE =
  "2.8+ means a 2.8 identity was seen. Unknown means we have no evidence, for example we haven't heard the node's key.";

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

  if (adoption.series.length === 0) {
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
              {adoption.series.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
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
                {slice.count} ({slice.percent.toFixed(0)}%)
              </span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">{NOTE}</p>
      </CardContent>
    </Card>
  );
}
