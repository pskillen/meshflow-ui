import { formatDistanceToNow } from 'date-fns';

/** Relative "x ago" for tooltips and non-React callers; mirrors StaleReportedTime friendly text. */
export function formatRecencyRelative(at: Date | string | number | null | undefined, fallback = '—'): string {
  if (at == null) return fallback;
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return fallback;
  return formatDistanceToNow(d, { addSuffix: true });
}

/** Compact relative time for tight spaces: "now", "14m ago", "5h ago", "3d ago". */
export function formatRecencyCompact(at: Date | string | number | null | undefined, fallback = '—'): string {
  if (at == null) return fallback;
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return fallback;
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
