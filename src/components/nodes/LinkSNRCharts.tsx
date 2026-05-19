import * as React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown } from 'lucide-react';
import type { NodeTracerouteLinkSnrHistory } from '@/hooks/api/useNodeTracerouteLinks';
import type { Formatter, Payload } from 'recharts/types/component/DefaultTooltipContent';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

/** Meshtastic LoRa typical SNR range (dB) for uniform Y-axis scaling */
const SNR_Y_DOMAIN: [number, number] = [-20, 10];

/** Colors for multi-series charts (one per peer) */
const PEER_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

interface LinkSNRChartsProps {
  snrHistory: NodeTracerouteLinkSnrHistory[];
  /** Number of links to show initially (default 3) */
  initialVisible?: number;
  /** Max number of links when expanded; omit to show all links on the map */
  maxLinks?: number;
  /** Full time range start for X-axis (when provided, X-axis shows full range) */
  timeRangeStart?: Date;
  /** Full time range end for X-axis */
  timeRangeEnd?: Date;
}

const chartConfig: ChartConfig = {
  inbound: { color: '#3b82f6', label: 'SNR In (dB)' },
  outbound: { color: '#22c55e', label: 'SNR Out (dB)' },
};

function mergeSnrPoints(
  inbound: Array<{ triggered_at: string; snr: number }>,
  outbound: Array<{ triggered_at: string; snr: number }>
): Array<{ timestamp: number; inbound?: number; outbound?: number }> {
  const byTime = new Map<number, { inbound?: number; outbound?: number }>();
  for (const p of inbound) {
    const t = new Date(p.triggered_at).getTime();
    const existing = byTime.get(t) ?? {};
    existing.inbound = p.snr;
    byTime.set(t, existing);
  }
  for (const p of outbound) {
    const t = new Date(p.triggered_at).getTime();
    const existing = byTime.get(t) ?? {};
    existing.outbound = p.snr;
    byTime.set(t, existing);
  }
  return Array.from(byTime.entries())
    .map(([timestamp, v]) => ({ timestamp, ...v }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function LinkSNRChart({
  inbound,
  outbound,
  timeRangeStart,
  timeRangeEnd,
}: {
  inbound: Array<{ triggered_at: string; snr: number }>;
  outbound: Array<{ triggered_at: string; snr: number }>;
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
}) {
  const chartData = React.useMemo(() => mergeSnrPoints(inbound, outbound), [inbound, outbound]);

  const formatter: Formatter<ValueType, NameType> = (value, name) => {
    if (value === undefined) return ['', name];
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue !== 'number' || isNaN(numValue)) return ['-', name];
    return [`${numValue.toFixed(1)} dB`, name];
  };

  const xDomain: [number, number] = React.useMemo(() => {
    if (timeRangeStart && timeRangeEnd) {
      return [timeRangeStart.getTime(), timeRangeEnd.getTime()];
    }
    if (chartData.length === 0) return [0, 1];
    const minTs = Math.min(...chartData.map((d) => d.timestamp));
    const maxTs = Math.max(...chartData.map((d) => d.timestamp));
    return [minTs, maxTs];
  }, [chartData, timeRangeStart, timeRangeEnd]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[120px] w-full min-w-0">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" className="opacity-50" />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          minTickGap={24}
          domain={xDomain}
          tickFormatter={(value: number) => {
            const date = new Date(value);
            return date.toLocaleString('en-GB', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          }}
          scale="time"
          type="number"
          tick={{ fontSize: 10 }}
        />
        <YAxis domain={SNR_Y_DOMAIN} tickFormatter={(v) => `${v} dB`} tick={{ fontSize: 10 }} width={36} />
        <Tooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload: readonly Payload<ValueType, NameType>[]) => {
                if (payload?.[0]?.payload?.timestamp) {
                  const date = new Date(payload[0].payload.timestamp);
                  return date.toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  });
                }
                return '';
              }}
              formatter={formatter}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="inbound"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          connectNulls
          name="SNR In"
        />
        <Line
          type="monotone"
          dataKey="outbound"
          stroke="#22c55e"
          strokeWidth={1.5}
          dot={false}
          connectNulls
          name="SNR Out"
        />
      </LineChart>
    </ChartContainer>
  );
}

/** Chart with one line per peer (for Combined view) */
function LinkSNRChartMultiSeries({
  series,
  timeRangeStart,
  timeRangeEnd,
}: {
  series: Array<{ peerKey: string; peerLabel: string; points: Array<{ triggered_at: string; snr: number }> }>;
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
}) {
  const chartData = React.useMemo(() => {
    const byTime = new Map<number, Record<string, number> & { timestamp: number }>();
    for (const s of series) {
      for (const p of s.points) {
        const t = new Date(p.triggered_at).getTime();
        const row = byTime.get(t) ?? { timestamp: t };
        row[s.peerKey] = p.snr;
        byTime.set(t, row);
      }
    }
    return Array.from(byTime.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [series]);

  const xDomain: [number, number] = React.useMemo(() => {
    if (timeRangeStart && timeRangeEnd) {
      return [timeRangeStart.getTime(), timeRangeEnd.getTime()];
    }
    if (chartData.length === 0) return [0, 1];
    const minTs = Math.min(...chartData.map((d) => d.timestamp));
    const maxTs = Math.max(...chartData.map((d) => d.timestamp));
    return [minTs, maxTs];
  }, [chartData, timeRangeStart, timeRangeEnd]);

  const formatter: Formatter<ValueType, NameType> = (value, name) => {
    if (value === undefined) return ['', name];
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof numValue !== 'number' || isNaN(numValue)) return ['-', name];
    return [`${numValue.toFixed(1)} dB`, name];
  };

  if (series.length === 0 || chartData.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[120px] w-full min-w-0">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 2" className="opacity-50" />
        <XAxis
          dataKey="timestamp"
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          minTickGap={24}
          domain={xDomain}
          tickFormatter={(value: number) => {
            const date = new Date(value);
            return date.toLocaleString('en-GB', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          }}
          scale="time"
          type="number"
          tick={{ fontSize: 10 }}
        />
        <YAxis domain={SNR_Y_DOMAIN} tickFormatter={(v) => `${v} dB`} tick={{ fontSize: 10 }} width={36} />
        <Tooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload: readonly Payload<ValueType, NameType>[]) => {
                if (payload?.[0]?.payload?.timestamp) {
                  const date = new Date(payload[0].payload.timestamp);
                  return date.toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  });
                }
                return '';
              }}
              formatter={formatter}
            />
          }
        />
        {series.map((s, i) => (
          <Line
            key={s.peerKey}
            type="monotone"
            dataKey={s.peerKey}
            stroke={PEER_COLORS[i % PEER_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            connectNulls
            name={s.peerLabel}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export function LinkSNRCharts({
  snrHistory,
  initialVisible = 3,
  maxLinks,
  timeRangeStart,
  timeRangeEnd,
}: LinkSNRChartsProps) {
  const [expanded, setExpanded] = React.useState(false);

  const allLinksSorted = React.useMemo(() => {
    const sorted = snrHistory
      .map((h) => {
        const inboundTs = h.inbound.map((p) => new Date(p.triggered_at).getTime());
        const outboundTs = h.outbound.map((p) => new Date(p.triggered_at).getTime());
        const allTs = [...inboundTs, ...outboundTs];
        return {
          ...h,
          totalPoints: h.inbound.length + h.outbound.length,
          latestTs: allTs.length ? Math.max(...allTs) : 0,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints || b.latestTs - a.latestTs);
    return maxLinks != null ? sorted.slice(0, maxLinks) : sorted;
  }, [snrHistory, maxLinks]);

  const linksToShow = expanded ? allLinksSorted : allLinksSorted.slice(0, initialVisible);
  const hasMore = allLinksSorted.length > initialVisible;
  const hiddenCount = allLinksSorted.length - initialVisible;

  const allInbound = React.useMemo(() => snrHistory.flatMap((h) => h.inbound), [snrHistory]);
  const allOutbound = React.useMemo(() => snrHistory.flatMap((h) => h.outbound), [snrHistory]);

  const inboundByPeer = React.useMemo(
    () =>
      snrHistory.map((h) => ({
        peerKey: `p${h.peer_node_id}`,
        peerLabel: h.peer_short_name || `!${h.peer_node_id.toString(16)}`,
        points: h.inbound,
      })),
    [snrHistory]
  );
  const outboundByPeer = React.useMemo(
    () =>
      snrHistory.map((h) => ({
        peerKey: `p${h.peer_node_id}`,
        peerLabel: h.peer_short_name || `!${h.peer_node_id.toString(16)}`,
        points: h.outbound,
      })),
    [snrHistory]
  );

  if (allLinksSorted.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
        No SNR history for links
      </div>
    );
  }

  return (
    <Tabs defaultValue="by-link" className="space-y-4">
      <TabsList>
        <TabsTrigger value="by-link">By link</TabsTrigger>
        <TabsTrigger value="by-direction">By direction</TabsTrigger>
        <TabsTrigger value="combined">Combined</TabsTrigger>
      </TabsList>
      <TabsContent value="by-link" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {linksToShow.map((link) => (
            <div key={link.peer_node_id} className="rounded-lg border p-3">
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Link to {link.peer_short_name || `!${link.peer_node_id.toString(16)}`}
              </div>
              <LinkSNRChart
                inbound={link.inbound}
                outbound={link.outbound}
                timeRangeStart={timeRangeStart}
                timeRangeEnd={timeRangeEnd}
              />
            </div>
          ))}
        </div>
        {hasMore && !expanded && (
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="w-full sm:w-auto">
            <ChevronDown className="mr-1 h-4 w-4" />
            Show all links ({hiddenCount} more)
          </Button>
        )}
      </TabsContent>
      <TabsContent value="by-direction" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium text-muted-foreground">All Inbound SNR (by peer)</div>
            <LinkSNRChartMultiSeries
              series={inboundByPeer}
              timeRangeStart={timeRangeStart}
              timeRangeEnd={timeRangeEnd}
            />
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium text-muted-foreground">All Outbound SNR (by peer)</div>
            <LinkSNRChartMultiSeries
              series={outboundByPeer}
              timeRangeStart={timeRangeStart}
              timeRangeEnd={timeRangeEnd}
            />
          </div>
        </div>
      </TabsContent>
      <TabsContent value="combined" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium text-muted-foreground">All Inbound SNR</div>
            <LinkSNRChart
              inbound={allInbound}
              outbound={[]}
              timeRangeStart={timeRangeStart}
              timeRangeEnd={timeRangeEnd}
            />
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-sm font-medium text-muted-foreground">All Outbound SNR</div>
            <LinkSNRChart
              inbound={[]}
              outbound={allOutbound}
              timeRangeStart={timeRangeStart}
              timeRangeEnd={timeRangeEnd}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
