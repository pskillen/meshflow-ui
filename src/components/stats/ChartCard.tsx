import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ChartCardProps {
  title: string;
  /** The one number for the range: "avg 88", "16,867". Right-aligned beside the title. */
  headline?: ReactNode;
  /** Plain-words pill saying what one point or bar is: "Packets per 6-hour bucket". */
  measure?: ReactNode;
  /** Controls for this chart only (a Total / By type toggle). Sits beside the measure pill. */
  actions?: ReactNode;
  /** Small print under the chart: partial-bucket and snapshot-lag notes. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** Title, headline number, measure pill and a slot for a chart. Knows nothing about the data. See ChartCard.md. */
export function ChartCard({
  title,
  headline,
  measure,
  actions,
  note,
  children,
  className,
  'data-testid': testId,
}: ChartCardProps) {
  return (
    <Card className={cn('min-w-0', className)} data-testid={testId}>
      <CardHeader className="space-y-1.5 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          {headline != null && (
            <div className="text-sm font-medium tabular-nums" data-testid={testId ? `${testId}-headline` : undefined}>
              {headline}
            </div>
          )}
        </div>
        {(measure != null || actions != null) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {measure != null ? (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                data-testid={testId ? `${testId}-measure` : undefined}
              >
                <Info className="h-3 w-3 shrink-0" aria-hidden />
                <span>{measure}</span>
              </span>
            ) : (
              <span />
            )}
            {actions}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-4 sm:px-6">
        {children}
        {note != null && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
