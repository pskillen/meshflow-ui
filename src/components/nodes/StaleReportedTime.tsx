import { enGB } from 'date-fns/locale';
import { format } from 'date-fns';
import { reportedTimeFreshness, type ReportedTimeFreshnessOptions } from '@/lib/reported-time-stale';
import { formatRecencyCompact, formatRecencyRelative } from '@/lib/reported-time-format';
import { cn } from '@/lib/utils';

const enGbDateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatAbsoluteEnGb(d: Date): string {
  return enGbDateTime.format(d);
}

export type StaleReportedTimeProps = {
  at: Date | string | number | null | undefined;
  /** When `at` is null/undefined/invalid */
  fallback?: string;
  className?: string;
  /** Overrides native `title` / tooltip when set. */
  title?: string;
  showFriendly?: boolean;
  showDateTime?: boolean;
  warningAfterHours?: number;
  dangerAfterHours?: number;
  /** `stale` = yellow/red bands; `neutral` = relative time only (e.g. message sent). */
  variant?: 'stale' | 'neutral';
  /** Short form ("14m ago") for tight layouts; the title still carries the full date. */
  compact?: boolean;
};

/**
 * Relative time ("x ago") with optional UK-style absolute text; yellow border at warning age, red at danger (unless `variant="neutral"`).
 */
export function StaleReportedTime({
  at,
  fallback = '—',
  className,
  title: titleOverride,
  showFriendly = true,
  showDateTime = false,
  warningAfterHours,
  dangerAfterHours,
  variant = 'stale',
  compact = false,
}: StaleReportedTimeProps) {
  const freshnessOpts: ReportedTimeFreshnessOptions | undefined =
    warningAfterHours != null || dangerAfterHours != null ? { warningAfterHours, dangerAfterHours } : undefined;

  if (at == null) {
    return <span className={className}>{fallback}</span>;
  }

  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) {
    return <span className={className}>{fallback}</span>;
  }

  const relative = compact ? formatRecencyCompact(d, fallback) : formatRecencyRelative(d, fallback);
  const absoluteEn = formatAbsoluteEnGb(d);
  const freshness = reportedTimeFreshness(d, freshnessOpts);

  const staleClasses =
    variant === 'stale' && freshness === 'stale24h'
      ? 'border border-yellow-500/70 bg-yellow-500/10 text-yellow-900 dark:border-yellow-500/60 dark:bg-yellow-500/15 dark:text-yellow-100'
      : variant === 'stale' && freshness === 'stale7d'
        ? 'border border-red-500/70 bg-red-500/10 text-red-900 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-100'
        : null;

  const title =
    titleOverride ??
    (showDateTime && showFriendly
      ? absoluteEn
      : showDateTime && !showFriendly
        ? formatRecencyRelative(d, fallback)
        : format(d, 'PPpp', { locale: enGB }));

  const inner = (
    <>
      {showFriendly ? relative : null}
      {showFriendly && showDateTime ? <span className="text-muted-foreground font-normal"> ({absoluteEn})</span> : null}
      {!showFriendly && showDateTime ? absoluteEn : null}
    </>
  );

  if (!showFriendly && !showDateTime) {
    return (
      <time dateTime={d.toISOString()} title={title} className={className}>
        {absoluteEn}
      </time>
    );
  }

  return (
    <time
      dateTime={d.toISOString()}
      title={title}
      className={cn(staleClasses && 'inline-block rounded px-1.5 py-0.5', staleClasses, className)}
    >
      {inner}
    </time>
  );
}
