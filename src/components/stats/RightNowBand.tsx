import { Component, Suspense, useId, type ErrorInfo, type ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import {
  useRecentNodeCountsBothSuspense,
  useRecentNodeCountsSuspense,
  type RecentNodeCounts,
} from '@/hooks/api/useNodes';
import { COUNT_COLUMNS, countFor, sumCounts } from '@/lib/recent-node-counts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from './StatTile';

export type RightNowScope = 'both' | 'meshtastic' | 'meshcore';

const nf = new Intl.NumberFormat('en-GB');
/** A count, or an em dash when the window was not reported. */
const n = (v: number | undefined) => (v == null ? '—' : nf.format(v));

function Band({ children }: { children: ReactNode }) {
  const headingId = useId();
  return (
    <section className="space-y-2 md:space-y-3" data-testid="right-now-band" aria-labelledby={headingId}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 id={headingId} className="text-sm md:text-base font-semibold">
          Right now
        </h2>
        <p className="hidden md:block text-xs text-muted-foreground">
          Fixed windows ending now; not affected by the range.
        </p>
      </div>
      {children}
    </section>
  );
}

function PhoneTable({ rows }: { rows: { label: string; counts: RecentNodeCounts }[] }) {
  return (
    <div className="lg:hidden rounded-lg border bg-card overflow-hidden" data-testid="right-now-table">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Nodes heard in each recent window</caption>
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th scope="col" className="text-left font-normal px-2.5 py-1.5">
              Heard in
            </th>
            {COUNT_COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-label={`${c.label}, ${c.window}`}
                className={`text-right font-normal px-2 py-1.5 ${c.hero ? 'text-foreground font-medium' : ''}`}
              >
                {c.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b last:border-0">
              <th scope="row" className="text-left font-normal px-2.5 py-1.5">
                {r.label}
              </th>
              {COUNT_COLUMNS.map((c) => (
                <td key={c.key} className={`text-right px-2 py-1.5 ${c.hero ? 'font-semibold' : ''}`}>
                  {n(countFor(r.counts, c.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface RightNowCountsProps {
  scope: RightNowScope;
  meshtastic?: RecentNodeCounts;
  meshcore?: RecentNodeCounts;
}

/** Presentational band: tiles from `lg` up, compact table below. Counts are passed in. */
export function RightNowCounts({ scope, meshtastic, meshcore }: RightNowCountsProps) {
  const both = scope === 'both';
  const own = scope === 'meshcore' ? meshcore : meshtastic;
  const rows = both
    ? [
        { label: 'Meshtastic', counts: meshtastic ?? {} },
        { label: 'MeshCore', counts: meshcore ?? {} },
      ]
    : [{ label: 'Nodes', counts: own ?? {} }];

  return (
    <Band>
      <PhoneTable rows={rows} />
      <div role="list" className="hidden lg:grid lg:grid-cols-5 gap-3" data-testid="right-now-tiles">
        {COUNT_COLUMNS.map((c) => (
          <StatTile
            key={c.key}
            role="listitem"
            data-testid={`right-now-tile-${c.key}`}
            hero={c.hero}
            label={c.label}
            value={n(both ? sumCounts(meshtastic, meshcore, c.key) : countFor(own, c.key))}
            sub={
              both ? (
                <>
                  {c.window}
                  <br />
                  MT {n(countFor(meshtastic, c.key))} · MC {n(countFor(meshcore, c.key))}
                </>
              ) : (
                c.window
              )
            }
          />
        ))}
      </div>
    </Band>
  );
}

function BothBand() {
  const { meshtastic, meshcore } = useRecentNodeCountsBothSuspense();
  return <RightNowCounts scope="both" meshtastic={meshtastic} meshcore={meshcore} />;
}

function SingleBand({ scope }: { scope: 'meshtastic' | 'meshcore' }) {
  const counts = useRecentNodeCountsSuspense(scope);
  return <RightNowCounts scope={scope} {...{ [scope]: counts }} />;
}

/** Fixed height so the page does not jump when the counts arrive. */
function BandSkeleton() {
  return <Skeleton className="h-32 w-full" data-testid="right-now-skeleton" aria-hidden />;
}

interface BandErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

/** Keeps a failed counts request inside the band: a small inline error with a retry, not a blank dashboard. */
class BandErrorBoundary extends Component<BandErrorBoundaryProps, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Right now band failed to load', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error == null) return this.props.children;
    // An expired session is the app-wide auth boundary's job, so pass it up.
    if (typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 401) throw error;
    return (
      <div
        role="alert"
        data-testid="right-now-error"
        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
      >
        <span className="text-muted-foreground">Couldn&apos;t load the Right now counts.</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            this.props.onReset();
            this.setState({ error: null });
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
}

/**
 * Fetches the counts for `scope` and renders the band. It carries its own Suspense boundary (fixed-height
 * skeleton) and error boundary, so a slow or failed request affects only the band, never the page.
 */
export function RightNowBand({ scope }: { scope: RightNowScope }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <BandErrorBoundary onReset={reset}>
          <Suspense fallback={<BandSkeleton />}>
            {scope === 'both' ? <BothBand /> : <SingleBand scope={scope} />}
          </Suspense>
        </BandErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
