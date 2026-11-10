/** Shown when the heard layer holds only the first page of nodes heard in the window. */
export function HeardTruncatedNotice({ shown, total, since }: { shown: number; total: number; since: Date }) {
  return (
    <p role="status" className="text-xs text-muted-foreground" data-testid="heard-truncated-notice">
      Heard layer shows the first {shown.toLocaleString()} of {total.toLocaleString()} nodes heard since{' '}
      {since.toLocaleDateString()}.
    </p>
  );
}
