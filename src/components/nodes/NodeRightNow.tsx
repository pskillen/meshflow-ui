import { useId } from 'react';
import { StatTile } from '@/components/stats/StatTile';
import { buildNodeNowCells } from '@/lib/node-now';
import type { ObservedNode } from '@/lib/models';

export interface NodeRightNowProps {
  node: ObservedNode;
  /** One line under the heading, desktop only. */
  note?: string;
}

/** Latest readings from one node: tiles from `md`, a one-row table on phones. See NodeRightNow.md. */
export function NodeRightNow({ node, note }: NodeRightNowProps) {
  const headingId = useId();
  const cells = buildNodeNowCells(node);
  const gridCols = cells.length >= 5 ? 'md:grid-cols-5' : 'md:grid-cols-1';

  return (
    <section className="mb-6 space-y-2 md:space-y-3" data-testid="node-right-now" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id={headingId} className="text-sm font-semibold md:text-base">
          Right now
        </h2>
        {note ? <p className="hidden text-xs text-muted-foreground md:block">{note}</p> : null}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card md:hidden" data-testid="node-right-now-table">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Latest readings from this node</caption>
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {cells.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-label={c.label}
                  className="px-2 py-1.5 text-right font-normal first:text-left"
                >
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cells.map((c) => (
                <td key={c.key} className="px-2 py-1.5 text-right first:text-left first:font-semibold">
                  {c.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`hidden gap-3 md:grid ${gridCols}`} data-testid="node-right-now-tiles">
        {cells.map((c) => (
          <StatTile
            key={c.key}
            label={c.label}
            value={c.value}
            sub={c.sub}
            hero={c.hero}
            data-testid={`node-right-now-tile-${c.key}`}
          />
        ))}
      </div>
    </section>
  );
}
