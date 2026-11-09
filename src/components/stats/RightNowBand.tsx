import { useRecentNodeCountsSuspense, type RecentNodeCounts } from '@/hooks/api/useNodes';
import { COUNT_COLUMNS, countFor, sumCounts } from '@/lib/recent-node-counts';
import { StatTile } from './StatTile';

export type RightNowScope = 'both' | 'meshtastic' | 'meshcore';

const nf = new Intl.NumberFormat('en-GB');
const n = (v: number) => nf.format(v);

function Band({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-2 md:space-y-3" data-testid="right-now-band">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-sm md:text-base font-semibold">Right now</h2>
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
    <div className="md:hidden rounded-lg border bg-card overflow-hidden" data-testid="right-now-table">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-left font-normal px-2.5 py-1.5">Heard in</th>
            {COUNT_COLUMNS.map((c) => (
              <th
                key={c.key}
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
              <td className="px-2.5 py-1.5">{r.label}</td>
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

/** Presentational band: tiles on desktop, compact table on phones. Counts are passed in. */
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
      <div className="hidden md:grid md:grid-cols-5 gap-3" data-testid="right-now-tiles">
        {COUNT_COLUMNS.map((c) => (
          <StatTile
            key={c.key}
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
  const meshtastic = useRecentNodeCountsSuspense('meshtastic');
  const meshcore = useRecentNodeCountsSuspense('meshcore');
  return <RightNowCounts scope="both" meshtastic={meshtastic} meshcore={meshcore} />;
}

function SingleBand({ scope }: { scope: 'meshtastic' | 'meshcore' }) {
  const counts = useRecentNodeCountsSuspense(scope);
  return <RightNowCounts scope={scope} {...{ [scope]: counts }} />;
}

/** Fetches the counts for `scope` (Suspense) and renders the band. Use inside a Suspense boundary. */
export function RightNowBand({ scope }: { scope: RightNowScope }) {
  return scope === 'both' ? <BothBand /> : <SingleBand scope={scope} />;
}
