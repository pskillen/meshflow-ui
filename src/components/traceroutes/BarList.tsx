import { Link } from 'react-router-dom';

export interface BarListRow {
  key: string;
  label: string;
  /** Bar fill, 0 to 100. */
  percent: number;
  /** Right-hand text: "82% · 40". Shown, but hidden from screen readers in favour of `spoken`. */
  text: string;
  /** The same figures in words, with units: "82% success, 40 runs". Supplied by the caller, who knows the units. */
  spoken: string;
  /** Link for the label (the target's traceroute history). */
  href?: string;
}

export interface BarListProps {
  rows: BarListRow[];
  /** Bar colour (CSS colour, normally a chart token). */
  color?: string;
  /** Accessible name for the list. */
  label: string;
  emptyMessage?: string;
}

/** Comparable horizontal bars: label, a bar on a shared 0-100 scale, a figure. Replaces pie slices. */
export function BarList({ rows, color = 'hsl(var(--chart-2))', label, emptyMessage = 'No data' }: BarListProps) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul role="list" aria-label={label} className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm">
          {row.href ? (
            <Link to={row.href} className="truncate hover:underline" title={row.label}>
              {row.label}
            </Link>
          ) : (
            <span className="truncate" title={row.label}>
              {row.label}
            </span>
          )}
          <div className="h-2 rounded bg-muted" aria-hidden="true">
            <div
              className="h-2 rounded"
              style={{ width: `${Math.max(0, Math.min(100, row.percent))}%`, background: color }}
            />
          </div>
          <span className="text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">
            {row.text}
          </span>
          <span className="sr-only">{row.spoken}</span>
        </li>
      ))}
    </ul>
  );
}
