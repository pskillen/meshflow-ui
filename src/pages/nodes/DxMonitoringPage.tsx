import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { ActivityIcon, RadioIcon } from 'lucide-react';
import { authService } from '@/lib/auth/authService';
import { buildDxTracerouteHistoryLink, formatDxExplorationSkipReason } from '@/lib/dx-exploration';
import type {
  DxDestinationNode,
  DxEventListItem,
  DxEventTracerouteExplorationRow,
  DxManagedNodeMinimal,
  DxObservedNodeHop,
  DxReasonCode,
} from '@/lib/models';
import { TRIGGER_TYPE_DX_WATCH, TRIGGER_TYPE_NEW_NODE_BASELINE } from '@/lib/traceroute-trigger-type';
import { nodeDetailPath } from '@/lib/node-detail-routes';

function dxObservedNodePath(node: { node_id_str: string; meshtastic_node_id: number }): string {
  return (
    nodeDetailPath({ node_id_str: node.node_id_str, protocol: 1, meshtastic_node_id: node.meshtastic_node_id }) ?? '#'
  );
}
import {
  useDxActiveEventCount,
  useDxEventDetail,
  useDxEvents,
  useDxNodeExclusionMutation,
  useDxNotificationSettings,
  useDxRecentEventCount,
} from '@/hooks/api/useDxMonitoring';
import type { DxEventsQueryParams } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<DxReasonCode, string> = {
  new_distant_node: 'New distant node',
  returned_dx_node: 'Returned DX node',
  distant_observation: 'Distant observation',
  traceroute_distant_hop: 'Traceroute distant hop',
};

function formatReason(code: string): string {
  return REASON_LABELS[code as DxReasonCode] ?? code;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'PPp', { locale: enGB });
}

function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { status?: number } }).response;
    return r?.status;
  }
  return undefined;
}

/** Primary line is short/long name; Meshtastic id is secondary when names exist, else sole label. */
function formatDestinationLabel(dest: DxDestinationNode): { primary: string; idSecondary?: string } {
  const long = dest.long_name?.trim();
  const short = dest.short_name?.trim();
  const primary = long && short ? (long === short ? long : `${long} (${short})`) : long || short || '';
  if (!primary) {
    return { primary: dest.node_id_str };
  }
  return { primary, idSecondary: dest.node_id_str };
}

function formatObserverLabel(obs: DxManagedNodeMinimal): { primary: string; idSecondary?: string } {
  const name = obs.name?.trim();
  if (name) {
    return { primary: name, idSecondary: obs.node_id_str };
  }
  return { primary: obs.node_id_str };
}

function formatHopLabel(hop: DxObservedNodeHop): { primary: string; idSecondary?: string } {
  const long = hop.long_name?.trim();
  const short = hop.short_name?.trim();
  const primary = long && short ? (long === short ? long : `${long} (${short})`) : long || short || '';
  if (!primary) {
    return { primary: hop.node_id_str };
  }
  return { primary, idSecondary: hop.node_id_str };
}

function explorationKindLabel(row: DxEventTracerouteExplorationRow): string {
  if (row.link_kind === 'new_node_baseline') return 'New node baseline';
  if (row.link_kind === 'dx_watch') return 'DX Watch';
  if (row.outcome === 'skipped') return 'Skipped';
  if (row.auto_traceroute?.trigger_type_label) return row.auto_traceroute.trigger_type_label;
  return '—';
}

function explorationHistoryHref(row: DxEventTracerouteExplorationRow): string {
  const targetNodeId = row.destination.meshtastic_node_id;
  const sourceNodeId = row.source_node?.meshtastic_node_id ?? null;
  if (row.link_kind === 'new_node_baseline') {
    return buildDxTracerouteHistoryLink({
      targetNodeId,
      sourceNodeId: sourceNodeId ?? undefined,
      triggerFilter: 'new_node_baseline',
    });
  }
  if (row.link_kind === 'dx_watch' || row.auto_traceroute?.trigger_type === TRIGGER_TYPE_DX_WATCH) {
    return buildDxTracerouteHistoryLink({
      targetNodeId,
      sourceNodeId: sourceNodeId ?? undefined,
      triggerFilter: 'dx_watch',
    });
  }
  if (row.auto_traceroute?.trigger_type === TRIGGER_TYPE_NEW_NODE_BASELINE) {
    return buildDxTracerouteHistoryLink({
      targetNodeId,
      sourceNodeId: sourceNodeId ?? undefined,
      triggerFilter: 'new_node_baseline',
    });
  }
  return buildDxTracerouteHistoryLink({ targetNodeId, sourceNodeId: sourceNodeId ?? undefined });
}

function explorationDetailNote(row: DxEventTracerouteExplorationRow): string {
  if (row.outcome === 'skipped' && row.skip_reason) {
    return formatDxExplorationSkipReason(row.skip_reason);
  }
  if (row.auto_traceroute?.error_message) {
    return row.auto_traceroute.error_message;
  }
  return '';
}

function NodeLinkLabel({ to, primary, idSecondary }: { to: string; primary: string; idSecondary?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <Link
        to={to}
        className="font-medium text-primary hover:underline truncate"
        title={idSecondary ? `${primary} · ${idSecondary}` : primary}
      >
        {primary}
      </Link>
      {idSecondary ? <span className="text-xs text-muted-foreground tabular-nums">{idSecondary}</span> : null}
    </div>
  );
}

export default function DxMonitoringPage() {
  const user = authService.getCurrentUser();
  const isStaff = Boolean(user?.is_staff);
  const dxNotifSettings = useDxNotificationSettings(isStaff);

  const [stateFilter, setStateFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [recentOnly, setRecentOnly] = useState(true);
  const [activeNow, setActiveNow] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const listParams: DxEventsQueryParams = useMemo(() => {
    const p: DxEventsQueryParams = { page, page_size: pageSize };
    if (stateFilter) p.state = stateFilter;
    if (reasonFilter) p.reason_code = reasonFilter;
    if (recentOnly) {
      p.recent_only = true;
      p.recent_days = 7;
    }
    if (activeNow) p.active_now = true;
    return p;
  }, [stateFilter, reasonFilter, recentOnly, activeNow, page, pageSize]);

  const listQuery = useDxEvents(listParams, isStaff);
  const activeCountQuery = useDxActiveEventCount(isStaff);
  const recentCountQuery = useDxRecentEventCount(isStaff, 7);

  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useDxEventDetail(detailId, Boolean(detailId));

  const [excludeTarget, setExcludeTarget] = useState<DxEventListItem | null>(null);
  const [excludeNotes, setExcludeNotes] = useState('');
  const exclusionMutation = useDxNodeExclusionMutation();

  const openDetail = (row: DxEventListItem) => {
    setDetailId(row.id);
  };

  const closeDetail = () => {
    setDetailId(null);
  };

  const confirmExclude = () => {
    if (!excludeTarget) return;
    exclusionMutation.mutate(
      {
        meshtastic_node_id: excludeTarget.destination.meshtastic_node_id,
        exclude_from_detection: true,
        exclude_notes: excludeNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          const { primary } = formatDestinationLabel(excludeTarget.destination);
          toast.success(`Excluded ${primary} from DX detection`);
          setExcludeTarget(null);
          setExcludeNotes('');
        },
        onError: () => {
          toast.error('Could not update exclusion');
        },
      }
    );
  };

  if (!isStaff) {
    return (
      <div className="container mx-auto max-w-lg p-6">
        <Card>
          <CardHeader>
            <CardTitle>DX monitoring</CardTitle>
            <CardDescription>
              This dashboard is available to staff only. If you need access, contact a Meshflow administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const listErr = listQuery.isError ? httpStatus(listQuery.error) : undefined;
  const detailErr = detailQuery.isError ? httpStatus(detailQuery.error) : undefined;
  const excludeDestLabel = excludeTarget ? formatDestinationLabel(excludeTarget.destination) : null;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <RadioIcon className="h-7 w-7" aria-hidden />
          DX monitoring
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detection events and evidence (read-only). Exclude noisy or mobile destinations from future DX detection when
          appropriate.
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
        <p className="text-muted-foreground">
          {dxNotifSettings.isLoading ? (
            <>Loading your DX Discord notification status…</>
          ) : dxNotifSettings.data ? (
            <>
              <span className="font-medium text-foreground">Your DX DMs:</span>{' '}
              {dxNotifSettings.data.enabled ? 'On' : 'Off'}
              {dxNotifSettings.data.discord.status === 'verified'
                ? ''
                : dxNotifSettings.data.discord.status === 'needs_relink'
                  ? ' (Discord needs refresh — see profile)'
                  : ' (link Discord on your profile)'}
            </>
          ) : dxNotifSettings.isError ? (
            <>Could not load notification status. You can still open settings from your profile.</>
          ) : (
            <>Optional DX alerts go to Discord DMs configured on your profile.</>
          )}
        </p>
        <Button asChild variant="outline" size="sm" className="shrink-0 w-fit">
          <Link to="/user#dx-notifications">Profile: DX notifications</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ActivityIcon className="h-4 w-4" />
              Active now
            </CardTitle>
            <CardDescription>State active and within active_until</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {activeCountQuery.isLoading ? '…' : (activeCountQuery.data ?? 0).toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Seen in last 7 days</CardTitle>
            <CardDescription>Any event with activity in the rolling window</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {recentCountQuery.isLoading ? '…' : (recentCountQuery.data ?? 0).toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Table page</CardTitle>
            <CardDescription>Matches filters below (not global totals)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {listQuery.data?.count != null ? listQuery.data.count.toLocaleString() : '—'}
          </CardContent>
        </Card>
      </div>

      {listErr === 403 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Your account does not have permission to load DX events (staff required).
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 items-end">
          <div className="space-y-2 min-w-[140px]">
            <Label>State</Label>
            <Select
              value={stateFilter || '__all__'}
              onValueChange={(v) => {
                setStateFilter(v === '__all__' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-[200px]">
            <Label>Reason</Label>
            <Select
              value={reasonFilter || '__all__'}
              onValueChange={(v) => {
                setReasonFilter(v === '__all__' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                <SelectItem value="new_distant_node">{REASON_LABELS.new_distant_node}</SelectItem>
                <SelectItem value="returned_dx_node">{REASON_LABELS.returned_dx_node}</SelectItem>
                <SelectItem value="distant_observation">{REASON_LABELS.distant_observation}</SelectItem>
                <SelectItem value="traceroute_distant_hop">{REASON_LABELS.traceroute_distant_hop}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={recentOnly}
              onCheckedChange={(v) => {
                setRecentOnly(Boolean(v));
                setPage(1);
              }}
            />
            Last 7 days
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={activeNow}
              onCheckedChange={(v) => {
                setActiveNow(Boolean(v));
                setPage(1);
              }}
            />
            Active now
          </label>
        </CardContent>
      </Card>

      {listQuery.isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      )}

      {listQuery.isError && listErr !== 403 && (
        <div className="text-center py-12 rounded-lg border border-destructive/50 text-destructive">
          Could not load DX events.
        </div>
      )}

      {listQuery.isSuccess && (
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Observer</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Exploration</TableHead>
                  <TableHead className="text-right">Best km</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.data.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      No events match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  listQuery.data.results.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{formatReason(row.reason_code)}</TableCell>
                      <TableCell>
                        <Badge variant={row.state === 'active' ? 'default' : 'secondary'}>{row.state}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 max-w-[16rem]">
                          <NodeLinkLabel
                            to={dxObservedNodePath(row.destination)}
                            {...formatDestinationLabel(row.destination)}
                          />
                          {row.destination.dx_metadata.exclude_from_detection && (
                            <Badge variant="outline" className="w-fit text-xs">
                              Excluded from DX
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[12rem]">
                        {row.last_observer ? (
                          <NodeLinkLabel
                            to={dxObservedNodePath(row.last_observer)}
                            {...formatObserverLabel(row.last_observer)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatWhen(row.first_observed_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatWhen(row.last_observed_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.evidence_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.exploration_attempt_count ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.best_distance_km != null ? row.best_distance_km.toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button variant="outline" size="sm" type="button" onClick={() => openDetail(row)}>
                          Detail
                        </Button>
                        {!row.destination.dx_metadata.exclude_from_detection && (
                          <Button variant="secondary" size="sm" type="button" onClick={() => setExcludeTarget(row)}>
                            Exclude
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center mt-4 text-sm text-muted-foreground">
              <span>
                Page {page} · {listQuery.data.results.length} rows
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!listQuery.data.next}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DX event</DialogTitle>
            <DialogDescription>
              Packet observations, destination metadata, and how traceroutes were queued or skipped for this candidate.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          )}
          {detailQuery.isError && detailErr === 403 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              You do not have permission to load this DX event.
            </div>
          )}
          {detailQuery.isError && detailErr !== 403 && (
            <div className="rounded-lg border border-destructive/50 px-4 py-3 text-sm text-destructive">
              Could not load DX event detail.
            </div>
          )}
          {detailQuery.isSuccess && detailQuery.data && (
            <div className="mt-2 space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground">Reason</div>
                <div className="font-medium">{formatReason(detailQuery.data.reason_code)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Destination</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <NodeLinkLabel
                    to={dxObservedNodePath(detailQuery.data.destination)}
                    {...formatDestinationLabel(detailQuery.data.destination)}
                  />
                  {detailQuery.data.destination.dx_metadata.exclude_from_detection && (
                    <Badge variant="outline">Excluded from DX</Badge>
                  )}
                </div>
              </div>
              {!detailQuery.data.destination.dx_metadata.exclude_from_detection && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setExcludeTarget(detailQuery.data)}>
                  Exclude destination from DX detection…
                </Button>
              )}
              <div>
                <div className="text-muted-foreground mb-2">Observations</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Observer</TableHead>
                      <TableHead className="text-right">km</TableHead>
                      <TableHead>Raw packet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuery.data.observations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground">
                          No observations recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detailQuery.data.observations.map((o) => {
                        const obsLabel = formatObserverLabel(o.observer);
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatWhen(o.observed_at)}</TableCell>
                            <TableCell className="text-xs max-w-[12rem]">
                              <NodeLinkLabel
                                to={dxObservedNodePath(o.observer)}
                                primary={obsLabel.primary}
                                idSecondary={obsLabel.idSecondary}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {o.distance_km != null ? o.distance_km.toFixed(1) : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs break-all">{o.raw_packet}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="text-muted-foreground">Exploration evidence</div>
                {(() => {
                  const explorations = detailQuery.data.traceroute_explorations ?? [];
                  const summary = detailQuery.data.exploration_summary ?? {
                    total: 0,
                    pending: 0,
                    completed: 0,
                    failed: 0,
                    skipped: 0,
                    baseline_linked_rows: 0,
                  };
                  return (
                    <>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline" className="tabular-nums">
                          Total {summary.total}
                        </Badge>
                        {summary.pending > 0 ? (
                          <Badge variant="secondary" className="tabular-nums">
                            Queued / in flight {summary.pending}
                          </Badge>
                        ) : null}
                        {summary.completed > 0 ? (
                          <Badge variant="default" className="tabular-nums">
                            Completed {summary.completed}
                          </Badge>
                        ) : null}
                        {summary.failed > 0 ? (
                          <Badge variant="destructive" className="tabular-nums">
                            Failed {summary.failed}
                          </Badge>
                        ) : null}
                        {summary.skipped > 0 ? (
                          <Badge variant="outline" className="tabular-nums">
                            Skipped {summary.skipped}
                          </Badge>
                        ) : null}
                        {summary.baseline_linked_rows > 0 ? (
                          <Badge variant="secondary" className="tabular-nums">
                            Baseline-linked rows {summary.baseline_linked_rows}
                          </Badge>
                        ) : null}
                      </div>
                      {summary.baseline_linked_rows > 0 ? (
                        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                          A new-node baseline traceroute already covered (or is covering) this destination for at least
                          one source. Those rows are linked here so a duplicate DX Watch traceroute was not queued for
                          the same path.
                        </p>
                      ) : null}
                      {explorations.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          No exploration attempts recorded for this event.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Outcome</TableHead>
                                <TableHead>Kind</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Schedule</TableHead>
                                <TableHead>Detail</TableHead>
                                <TableHead />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {explorations.map((row) => {
                                const tr = row.auto_traceroute;
                                const note = explorationDetailNote(row);
                                const outcomeVariant =
                                  row.outcome === 'failed'
                                    ? 'destructive'
                                    : row.outcome === 'skipped'
                                      ? 'secondary'
                                      : row.outcome === 'completed'
                                        ? 'default'
                                        : 'outline';
                                return (
                                  <TableRow key={row.id}>
                                    <TableCell className="whitespace-nowrap">
                                      <Badge variant={outcomeVariant}>{row.outcome}</Badge>
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                      {explorationKindLabel(row)}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[10rem]">
                                      {row.source_node ? (
                                        <NodeLinkLabel
                                          to={dxObservedNodePath(row.source_node)}
                                          {...formatObserverLabel(row.source_node)}
                                        />
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[10rem]">
                                      <NodeLinkLabel
                                        to={dxObservedNodePath(row.destination)}
                                        {...formatHopLabel(row.destination)}
                                      />
                                    </TableCell>
                                    <TableCell className="text-xs align-top min-w-[10rem]">
                                      {tr ? (
                                        <ul className="list-none space-y-1 m-0 p-0">
                                          <li>
                                            <span className="text-muted-foreground">Triggered</span>{' '}
                                            <span className="whitespace-nowrap">{formatWhen(tr.triggered_at)}</span>
                                          </li>
                                          <li>
                                            <span className="text-muted-foreground">Earliest send</span>{' '}
                                            <span className="whitespace-nowrap">{formatWhen(tr.earliest_send_at)}</span>
                                          </li>
                                          <li>
                                            <span className="text-muted-foreground">Dispatched</span>{' '}
                                            <span className="whitespace-nowrap">
                                              {tr.dispatched_at ? formatWhen(tr.dispatched_at) : '—'}
                                            </span>
                                          </li>
                                          <li>
                                            <span className="text-muted-foreground">Completed</span>{' '}
                                            <span className="whitespace-nowrap">
                                              {tr.completed_at ? formatWhen(tr.completed_at) : '—'}
                                            </span>
                                          </li>
                                        </ul>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[14rem]">
                                      {note ? <span className="break-words">{note}</span> : '—'}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                      <Link
                                        to={explorationHistoryHref(row)}
                                        className="text-primary text-xs hover:underline"
                                      >
                                        Traceroutes
                                      </Link>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(excludeTarget)} onOpenChange={(o) => !o && setExcludeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclude from DX detection?</DialogTitle>
            <DialogDescription>
              Future DX candidate detection will ignore{' '}
              {excludeDestLabel ? (
                <>
                  <span className="font-medium">{excludeDestLabel.primary}</span>
                  {excludeDestLabel.idSecondary ? (
                    <>
                      {' '}
                      (<span className="font-mono">{excludeDestLabel.idSecondary}</span>)
                    </>
                  ) : null}
                </>
              ) : null}
              . Use for known mobile or noisy stations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dx-exclude-notes">Note (optional)</Label>
            <textarea
              id="dx-exclude-notes"
              value={excludeNotes}
              onChange={(e) => setExcludeNotes(e.target.value)}
              placeholder="e.g. vehicle gateway"
              rows={3}
              className={cn(
                'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setExcludeTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={exclusionMutation.isPending} onClick={confirmExclude}>
              {exclusionMutation.isPending ? 'Saving…' : 'Exclude node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
