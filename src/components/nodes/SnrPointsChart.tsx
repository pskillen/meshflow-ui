import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { ChartCardContext } from '@/components/stats/chart-card-context';
import type { StatsBucket, StatsRangeWindow } from '@/lib/stats-range';
import { buildBucketGrid, evenTrendTicks, formatTrendTick, maxTrendTicks } from '@/lib/stats-trend';
import { snrWindowEndMs, type RawSnrPoint } from '@/lib/node-traceroute-snr';

export interface SnrPointsChartProps {
  /** One link's raw samples in the window, oldest first (`rawLinkSnr`). */
  points: RawSnrPoint[];
  window: Pick<StatsRangeWindow, 'start' | 'end' | 'lastBucketStart' | 'partialEnd'>;
  bucket: StatsBucket;
  /** Fixed y range in dB, the same on every card. */
  yRange: [number, number];
  /** A tick every this many dB from the bottom of `yRange`. */
  yTickStep: number;
  /** Accessible name stem: "SNR with PEER, last 7 days". */
  label: string;
  height?: number;
}

const Y_AXIS_WIDTH = 44;
const DEFAULT_WIDTH = 800;
const RADIUS = 2.5;
/** The most samples listed in the screen-reader table; older ones are summarised in one line. */
export const SNR_TABLE_CAP = 200;

const COLOR_IN = 'hsl(var(--chart-1))';
const COLOR_OUT = 'hsl(var(--chart-4))';

const formatDb = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const formatUtc = (t: number) => `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

type ShapeProps = { cx?: number; cy?: number };

/** Inbound: a filled circle. */
function CircleMark({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={RADIUS} fill={COLOR_IN} />;
}

/** Outbound: a hollow triangle, so direction is never told by colour alone. */
function TriangleMark({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  const r = RADIUS + 1;
  const pts = `${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`;
  return <polygon points={pts} fill="none" stroke={COLOR_OUT} strokeWidth={2} />;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: RawSnrPoint }> }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatUtc(p.t)}</div>
      <div className="text-muted-foreground">
        {p.dir === 'inbound' ? 'Inbound' : 'Outbound'}: {formatDb(p.snr)} dB
      </div>
    </div>
  );
}

/**
 * Every traceroute SNR sample of one link as a dot at its own time: inbound filled circles, outbound hollow
 * triangles. The x axis is the same window and ticks as the Means view. See SnrPointsChart.md.
 */
export function SnrPointsChart({
  points,
  window,
  bucket,
  yRange,
  yTickStep,
  label,
  height = 190,
}: SnrPointsChartProps) {
  const { headlineId } = useContext(ChartCardContext);
  const startMs = window.start.getTime();
  const endMs = snrWindowEndMs(window, bucket);
  const inbound = useMemo(() => points.filter((p) => p.dir === 'inbound'), [points]);
  const outbound = useMemo(() => points.filter((p) => p.dir === 'outbound'), [points]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(w);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xTicks = useMemo(
    () => evenTrendTicks(buildBucketGrid(window, bucket), maxTrendTicks(width - Y_AXIS_WIDTH)),
    [window, bucket, width]
  );
  const yTicks = useMemo(() => {
    const [lo, hi] = yRange;
    const out: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += yTickStep) out.push(v);
    return out;
  }, [yRange, yTickStep]);

  const config = useMemo<ChartConfig>(
    () => ({
      inbound: { label: 'SNR in (dB)', color: COLOR_IN },
      outbound: { label: 'SNR out (dB)', color: COLOR_OUT },
    }),
    []
  );

  const name = `${label}, raw samples: ${inbound.length} inbound, ${outbound.length} outbound.`;
  const listed = points.slice(-SNR_TABLE_CAP);
  const earlier = points.length - listed.length;

  return (
    <>
      <ChartContainer
        ref={boxRef}
        config={config}
        className="aspect-auto w-full"
        style={{ height }}
        role="img"
        aria-label={name}
        aria-describedby={headlineId}
        data-testid="snr-points-chart"
      >
        <ScatterChart margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.5} />
          <XAxis
            type="number"
            dataKey="t"
            scale="time"
            domain={[startMs, endMs]}
            ticks={xTicks}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tickFormatter={(t: number) => formatTrendTick(t, bucket)}
          />
          <YAxis
            type="number"
            dataKey="snr"
            width={Y_AXIS_WIDTH}
            tickLine={false}
            axisLine={false}
            domain={yRange}
            allowDataOverflow
            ticks={yTicks}
            tickFormatter={formatDb}
          />
          <Tooltip content={<PointTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="SNR in (dB)" data={inbound} shape={<CircleMark />} isAnimationActive={false} />
          <Scatter name="SNR out (dB)" data={outbound} shape={<TriangleMark />} isAnimationActive={false} />
        </ScatterChart>
      </ChartContainer>
      <div
        className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
        data-testid="snr-points-legend"
      >
        <span className="inline-flex items-center gap-1">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r={RADIUS} fill={COLOR_IN} />
          </svg>
          SNR in (dB)
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="10" height="10" aria-hidden>
            <polygon points="5,1 9,8 1,8" fill="none" stroke={COLOR_OUT} strokeWidth="2" />
          </svg>
          SNR out (dB)
        </span>
      </div>
      <div className="sr-only">
        <table data-testid="snr-points-table">
          <caption>{name}</caption>
          <thead>
            <tr>
              <th scope="col">Time (UTC)</th>
              <th scope="col">Direction</th>
              <th scope="col">SNR (dB)</th>
            </tr>
          </thead>
          <tbody>
            {listed.map((p, i) => (
              <tr key={`${p.t}-${p.dir}-${i}`}>
                <th scope="row">{formatUtc(p.t)}</th>
                <td>{p.dir}</td>
                <td>{formatDb(p.snr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {earlier > 0 && <p>{`and ${earlier} earlier ${earlier === 1 ? 'sample' : 'samples'}`}</p>}
      </div>
    </>
  );
}
