import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { toast } from 'sonner';
import { authService } from '@/lib/auth/authService';
import type { MeshCorePathEdgeBucket, MeshCorePathSegment } from '@/lib/models';
import type { PathTracingQueryParams } from '@/lib/types';
import { useAnnotatePathSegment, usePathTracingEdges, usePathTracingSegments } from '@/hooks/api/usePathTracing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const SEGMENT_STATUSES = ['unknown', 'resolved', 'ambiguous', 'stale'] as const;
const PAGE_SIZE = 100;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'PPp', { locale: enGB });
}

function segmentNodeLabel(seg: MeshCorePathSegment): string {
  const node = seg.observed_node;
  if (!node) return '—';
  if (node.long_name?.trim()) {
    return node.node_id_str ? `${node.long_name} (${node.node_id_str})` : node.long_name;
  }
  return node.node_id_str ?? node.internal_id;
}

function snrSummary(edge: MeshCorePathEdgeBucket): string {
  if (edge.avg_snr == null) return '—';
  const parts = [`avg ${edge.avg_snr.toFixed(1)}`];
  if (edge.min_snr != null && edge.max_snr != null) {
    parts.push(`[${edge.min_snr.toFixed(1)}, ${edge.max_snr.toFixed(1)}]`);
  }
  return parts.join(' ');
}

function SegmentStatusBadge({ status }: { status: string }) {
  const isUnknown = status === 'unknown';
  return (
    <Badge
      variant={isUnknown ? 'outline' : 'secondary'}
      className={cn(isUnknown && 'border-dashed font-mono text-muted-foreground')}
    >
      {status}
    </Badge>
  );
}

function SegmentHashCell({ hash, status }: { hash: string; status: string }) {
  const isUnknown = status === 'unknown';
  return (
    <span
      className={cn(
        'font-mono text-xs break-all',
        isUnknown && 'border border-dashed border-muted-foreground/60 rounded px-1 py-0.5 text-muted-foreground'
      )}
    >
      {hash}
    </span>
  );
}

export function MeshCorePassivePath() {
  const isStaff = Boolean(authService.getCurrentUser()?.is_staff);

  const [segmentStatus, setSegmentStatus] = useState<string>('');
  const [segmentHashMode, setSegmentHashMode] = useState('');
  const [segmentHashSize, setSegmentHashSize] = useState('');
  const [segmentHash, setSegmentHash] = useState('');

  const [edgeBucketAfter, setEdgeBucketAfter] = useState('');
  const [edgeBucketBefore, setEdgeBucketBefore] = useState('');
  const [edgeObserver, setEdgeObserver] = useState('');
  const [edgeFromHash, setEdgeFromHash] = useState('');
  const [edgeToHash, setEdgeToHash] = useState('');

  const [annotateSegmentId, setAnnotateSegmentId] = useState('');
  const [annotateNodeIdStr, setAnnotateNodeIdStr] = useState('');
  const [annotateStatus, setAnnotateStatus] = useState<string>('resolved');

  const segmentParams = useMemo((): PathTracingQueryParams => {
    const p: PathTracingQueryParams = { page: 1, page_size: PAGE_SIZE };
    if (segmentStatus) p.status = segmentStatus;
    if (segmentHashMode.trim()) p.hash_mode = Number(segmentHashMode);
    if (segmentHashSize.trim()) p.hash_size = Number(segmentHashSize);
    if (segmentHash.trim()) p.segment_hash = segmentHash.trim();
    return p;
  }, [segmentStatus, segmentHashMode, segmentHashSize, segmentHash]);

  const edgeParams = useMemo((): PathTracingQueryParams => {
    const p: PathTracingQueryParams = { page: 1, page_size: PAGE_SIZE };
    if (edgeBucketAfter.trim()) p.bucket_start_after = edgeBucketAfter.trim();
    if (edgeBucketBefore.trim()) p.bucket_start_before = edgeBucketBefore.trim();
    if (edgeObserver.trim()) p.observer = edgeObserver.trim();
    if (edgeFromHash.trim()) p.from_hash = edgeFromHash.trim();
    if (edgeToHash.trim()) p.to_hash = edgeToHash.trim();
    return p;
  }, [edgeBucketAfter, edgeBucketBefore, edgeObserver, edgeFromHash, edgeToHash]);

  const segmentsQuery = usePathTracingSegments(segmentParams);
  const edgesQuery = usePathTracingEdges(edgeParams);
  const annotateMutation = useAnnotatePathSegment();

  const handleAnnotate = async () => {
    const id = annotateSegmentId.trim();
    if (!id) {
      toast.error('Segment id is required');
      return;
    }
    try {
      await annotateMutation.mutateAsync({
        segmentId: id,
        body: {
          node_id_str: annotateNodeIdStr.trim() || undefined,
          status: annotateStatus || undefined,
        },
      });
      toast.success('Segment annotated');
      setAnnotateSegmentId('');
      setAnnotateNodeIdStr('');
    } catch {
      toast.error('Annotation failed');
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6" data-testid="meshcore-passive-path-page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Passive path tracing (preview)</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Diagnostic tables for MeshCore hash-chain edges and segment resolution. Use this view to compare{' '}
          <code className="text-xs">path_hash_mode</code> / <code className="text-xs">path_hash_size</code>{' '}
          distributions before M2 decisions. Full map and realtime UI are planned separately (M7).
        </p>
      </div>

      <Card data-testid="passive-path-segments">
        <CardHeader>
          <CardTitle>Path segments</CardTitle>
          <CardDescription>
            Segment hashes seen on ingest; unknown rows use dashed styling (same convention as heard-path maps).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="seg-status">Status</Label>
              <Select value={segmentStatus || 'all'} onValueChange={(v) => setSegmentStatus(v === 'all' ? '' : v)}>
                <SelectTrigger id="seg-status" data-testid="segment-filter-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {SEGMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="seg-mode">Hash mode</Label>
              <Input
                id="seg-mode"
                inputMode="numeric"
                placeholder="Any"
                value={segmentHashMode}
                onChange={(e) => setSegmentHashMode(e.target.value)}
                data-testid="segment-filter-hash-mode"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seg-size">Hash size</Label>
              <Input
                id="seg-size"
                inputMode="numeric"
                placeholder="Any"
                value={segmentHashSize}
                onChange={(e) => setSegmentHashSize(e.target.value)}
                data-testid="segment-filter-hash-size"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seg-hash">Segment hash</Label>
              <Input
                id="seg-hash"
                placeholder="Prefix or full hash"
                value={segmentHash}
                onChange={(e) => setSegmentHash(e.target.value)}
                data-testid="segment-filter-hash"
              />
            </div>
          </div>

          {segmentsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading segments…</p>}
          {segmentsQuery.isError && <p className="text-sm text-destructive">Failed to load segments.</p>}
          {segmentsQuery.isSuccess && (
            <>
              <p className="text-xs text-muted-foreground">
                {segmentsQuery.data.count} segment(s) (showing up to {PAGE_SIZE})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hash</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>First seen</TableHead>
                    <TableHead>Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segmentsQuery.data.results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No segments
                      </TableCell>
                    </TableRow>
                  ) : (
                    segmentsQuery.data.results.map((seg) => (
                      <TableRow key={seg.id} data-testid={`segment-row-${seg.id}`}>
                        <TableCell>
                          <SegmentHashCell hash={seg.segment_hash} status={seg.status} />
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{seg.hash_size ?? '—'}</TableCell>
                        <TableCell className="font-mono tabular-nums">{seg.hash_mode ?? '—'}</TableCell>
                        <TableCell>
                          <SegmentStatusBadge status={seg.status} />
                        </TableCell>
                        <TableCell className="text-sm">{segmentNodeLabel(seg)}</TableCell>
                        <TableCell className="text-xs">{seg.source}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatWhen(seg.first_seen_at)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatWhen(seg.last_seen_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}

          {isStaff && (
            <div className="rounded-md border p-4 space-y-3" data-testid="staff-annotate-panel">
              <p className="text-sm font-medium">Staff: manual segment annotation</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="annotate-seg-id">Segment id (UUID)</Label>
                  <Input
                    id="annotate-seg-id"
                    value={annotateSegmentId}
                    onChange={(e) => setAnnotateSegmentId(e.target.value)}
                    data-testid="annotate-segment-id"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="annotate-node">Node id (mc:…)</Label>
                  <Input
                    id="annotate-node"
                    placeholder="mc:…"
                    value={annotateNodeIdStr}
                    onChange={(e) => setAnnotateNodeIdStr(e.target.value)}
                    data-testid="annotate-node-id-str"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="annotate-status">Status</Label>
                  <Select value={annotateStatus} onValueChange={setAnnotateStatus}>
                    <SelectTrigger id="annotate-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEGMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void handleAnnotate()}
                disabled={annotateMutation.isPending}
                data-testid="annotate-submit"
              >
                {annotateMutation.isPending ? 'Saving…' : 'Annotate segment'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="passive-path-edges">
        <CardHeader>
          <CardTitle>Path edges (hourly buckets)</CardTitle>
          <CardDescription>
            Consecutive hash pairs from list-order <code className="text-xs">path_hashes</code>. Direction is list order
            only, not RF forwarding direction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="edge-after">Bucket start after (ISO)</Label>
              <Input
                id="edge-after"
                placeholder="2026-06-01T00:00:00Z"
                value={edgeBucketAfter}
                onChange={(e) => setEdgeBucketAfter(e.target.value)}
                data-testid="edge-filter-bucket-after"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edge-before">Bucket start before (ISO)</Label>
              <Input
                id="edge-before"
                placeholder="2026-06-02T00:00:00Z"
                value={edgeBucketBefore}
                onChange={(e) => setEdgeBucketBefore(e.target.value)}
                data-testid="edge-filter-bucket-before"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edge-observer">Observer (managed node id)</Label>
              <Input
                id="edge-observer"
                value={edgeObserver}
                onChange={(e) => setEdgeObserver(e.target.value)}
                data-testid="edge-filter-observer"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edge-from">From hash</Label>
              <Input
                id="edge-from"
                value={edgeFromHash}
                onChange={(e) => setEdgeFromHash(e.target.value)}
                data-testid="edge-filter-from-hash"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edge-to">To hash</Label>
              <Input
                id="edge-to"
                value={edgeToHash}
                onChange={(e) => setEdgeToHash(e.target.value)}
                data-testid="edge-filter-to-hash"
              />
            </div>
          </div>

          {edgesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading edges…</p>}
          {edgesQuery.isError && <p className="text-sm text-destructive">Failed to load edges.</p>}
          {edgesQuery.isSuccess && (
            <>
              <p className="text-xs text-muted-foreground">
                {edgesQuery.data.count} edge bucket(s) (showing up to {PAGE_SIZE})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Observer</TableHead>
                    <TableHead>Packets</TableHead>
                    <TableHead>Observations</TableHead>
                    <TableHead>SNR</TableHead>
                    <TableHead>Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {edgesQuery.data.results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No edges
                      </TableCell>
                    </TableRow>
                  ) : (
                    edgesQuery.data.results.map((edge) => (
                      <TableRow key={edge.id} data-testid={`edge-row-${edge.id}`}>
                        <TableCell className="text-xs whitespace-nowrap">{formatWhen(edge.bucket_start)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {edge.from_hash} → {edge.to_hash}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{edge.direction}</TableCell>
                        <TableCell className="text-xs">{edge.observer_name ?? edge.observer ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{edge.packet_count}</TableCell>
                        <TableCell className="tabular-nums">{edge.observation_count}</TableCell>
                        <TableCell className="text-xs">{snrSummary(edge)}</TableCell>
                        <TableCell>{edge.resolved ? 'yes' : 'no'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MeshCorePassivePath;
