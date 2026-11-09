import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Small line(s) under the value. */
  sub?: ReactNode;
  /** Emphasised border for the headline tile of a band. */
  hero?: boolean;
  className?: string;
  'data-testid'?: string;
}

/** A generic stat tile: label, big value, optional subtext. Knows nothing about node counts. */
export function StatTile({ label, value, sub, hero = false, className, 'data-testid': testId }: StatTileProps) {
  return (
    <div
      data-testid={testId}
      className={cn('rounded-lg border bg-card p-3.5', hero && 'border-foreground/30', className)}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
      {sub != null && <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{sub}</div>}
    </div>
  );
}
