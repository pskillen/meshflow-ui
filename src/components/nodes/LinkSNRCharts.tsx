import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricTrendCard } from '@/components/nodes/MetricTrendCard';
import type { StatsRange } from '@/hooks/useStatsRange';
import type { NodeTracerouteLinkSnrHistory } from '@/hooks/api/useNodeTracerouteLinks';
import { SNR_IN, SNR_OUT, bucketLinkSnr, meanOfDrawn, peerLabel, sortLinksByActivity } from '@/lib/node-traceroute-snr';
import { markPartialBuckets, bucketPhrase } from '@/lib/stats-trend';

/** Meshtastic LoRa typical SNR range (dB), the same on every link so the charts compare. */
const SNR_Y_RANGE: [number, number] = [-20, 10];

const SNR_SERIES = [
  { key: SNR_IN, label: 'SNR in (dB)', color: 'hsl(var(--chart-1))' },
  { key: SNR_OUT, label: 'SNR out (dB)', color: 'hsl(var(--chart-4))', dashed: true },
];

/** No unit on the axis (the measure pill says dB): "2.5 dB" wraps in the 44px axis on a phone. */
const formatDb = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export interface LinkSNRChartsProps {
  snrHistory: NodeTracerouteLinkSnrHistory[];
  /** The page's shared range: fixes the x axis and the bucket size. */
  range: StatsRange;
  /** Links shown before "Show all" (default 4). */
  initialVisible?: number;
}

function headlineFor(rows: Array<Record<string, unknown>>): string | undefined {
  const inbound = meanOfDrawn(rows, SNR_IN);
  const outbound = meanOfDrawn(rows, SNR_OUT);
  const parts = [
    inbound != null ? `in ${inbound.toFixed(1)}` : null,
    outbound != null ? `out ${outbound.toFixed(1)}` : null,
  ].filter(Boolean);
  return parts.length ? `avg ${parts.join(' / ')} dB` : undefined;
}

function LinkCard({ link, range }: { link: NodeTracerouteLinkSnrHistory; range: StatsRange }) {
  const rows = React.useMemo(
    () => markPartialBuckets(bucketLinkSnr(link, range.window, range.bucket), range.window, range.bucket),
    [link, range.window, range.bucket]
  );
  const label = peerLabel(link);
  const series = SNR_SERIES.filter((s) => rows.some((r) => typeof r[s.key] === 'number'));
  return (
    <MetricTrendCard
      title={`SNR with ${label}`}
      headline={headlineFor(rows)}
      measure={`Mean SNR in dB per ${bucketPhrase(range.bucket)}, from traceroutes`}
      range={range}
      rows={rows}
      series={series.length ? series : SNR_SERIES}
      yRange={SNR_Y_RANGE}
      formatValue={formatDb}
      dots
      empty={series.length === 0 ? 'No SNR samples from traceroutes in this range.' : undefined}
      data-testid={`chart-link-snr-${link.peer_node_id}`}
    />
  );
}

/** SNR per link: one chart card per peer on the shared range, inbound and outbound together. See LinkSNRCharts.md. */
export function LinkSNRCharts({ snrHistory, range, initialVisible = 4 }: LinkSNRChartsProps) {
  const [expanded, setExpanded] = React.useState(false);
  const sorted = React.useMemo(() => sortLinksByActivity(snrHistory), [snrHistory]);

  if (sorted.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
        No SNR history for links
      </div>
    );
  }

  const shown = expanded ? sorted : sorted.slice(0, initialVisible);
  const hidden = sorted.length - shown.length;

  return (
    <div className="space-y-3" data-testid="link-snr-charts">
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((link) => (
          <LinkCard key={link.peer_node_id} link={link} range={range} />
        ))}
      </div>
      {hidden > 0 && (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="w-full sm:w-auto">
          <ChevronDown className="mr-1 h-4 w-4" />
          Show all links ({hidden} more)
        </Button>
      )}
    </div>
  );
}
