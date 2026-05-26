import { useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useTraceroutesInfiniteWithWebSocket } from '@/hooks/useTraceroutesWithWebSocket';
import { useTracerouteTriggerableNodesSuspense, useTriggerTraceroute } from '@/hooks/api/useTraceroutes';
import { useManagedNodesSuspense, useNodesSuspense } from '@/hooks/api/useNodes';
import { TriggerTracerouteModal, TriggerMode } from './TriggerTracerouteModal';
import { TracerouteDetailModal } from './TracerouteDetailModal';
import { getTracerouteErrorMessage } from './tracerouteErrors';
import { StrategyBadge } from '@/components/traceroutes/StrategyBadge';
import { TracerouteQueueDispatchCell } from '@/components/traceroutes/TracerouteQueueDispatchCell';
import { TracerouteStatusBadge } from '@/components/traceroutes/TracerouteStatusBadge';
import { AutoTraceRoute, ObservedNode } from '@/lib/models';
import { TracerouteElapsedCell } from '@/components/traceroutes/TracerouteElapsedCell';
import { TRACEROUTE_STRATEGIES, type TracerouteStrategyValue } from '@/lib/traceroute-strategy';
import {
  TRIGGER_TYPE_EXTERNAL,
  TRIGGER_TYPE_FILTER_OPTIONS,
  type TriggerTypeFilterToken,
  labelForTriggerTypeApi,
  labelForTriggerTypeFilterToken,
} from '@/lib/traceroute-trigger-type';
import { ChevronDown, RotateCw, RouteIcon, X } from 'lucide-react';

type StatusValue = 'completed' | 'failed' | 'pending' | 'sent';
const STATUS_OPTIONS: Array<{ value: StatusValue; label: string }> = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Queued' },
  { value: 'sent', label: 'In flight' },
];
const SUCCESS_STATUS_PRESET: StatusValue[] = ['completed', 'pending', 'sent'];

const STRATEGY_FILTER_OPTIONS: Array<{ value: TracerouteStrategyValue; label: string }> = TRACEROUTE_STRATEGIES.map(
  (value) => ({
    value,
    label:
      value === 'intra_zone'
        ? 'Intra-zone'
        : value === 'dx_across'
          ? 'DX across'
          : value === 'dx_same_side'
            ? 'DX same side'
            : 'Legacy',
  })
);

function routeSummary(tr: AutoTraceRoute): string {
  const route = tr.route;
  const routeBack = tr.route_back;
  const outEmpty = !route || route.length === 0;
  const backEmpty = !routeBack || routeBack.length === 0;
  if (outEmpty && backEmpty) {
    return tr.status === 'completed' ? 'Direct' : '—';
  }
  const outStr = outEmpty ? 'Direct' : `${route.length} hops`;
  const backStr = backEmpty ? 'Direct' : `${routeBack.length} hops`;
  return `${outStr} out, ${backStr} back`;
}

function parseCsvParam<T extends string>(raw: string | null): T[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as T[];
}

function parseNumberParam(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function triggerTypeMultiLabel(values: TriggerTypeFilterToken[]): string {
  if (values.length === 0) return 'Trigger type';
  if (values.length === 1) return labelForTriggerTypeFilterToken(values[0]);
  return `Trigger type (${values.length})`;
}

function multiSelectLabel<T extends string>(
  values: T[],
  options: Array<{ value: T; label: string }>,
  fallback: string
): string {
  if (values.length === 0) return fallback;
  if (values.length === 1) {
    return options.find((o) => o.value === values[0])?.label ?? values[0];
  }
  return `${fallback} (${values.length})`;
}

export function TracerouteHistory() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Hydrate filters from URL search params (single source of truth).
  const sourceNodeId = parseNumberParam(searchParams.get('source_node'));
  const targetNodeId = parseNumberParam(searchParams.get('target_node'));
  const statusValues = parseCsvParam<StatusValue>(searchParams.get('status'));
  const triggerTypeValues = parseCsvParam(searchParams.get('trigger_type')) as TriggerTypeFilterToken[];
  const strategyValues = parseCsvParam<TracerouteStrategyValue>(searchParams.get('strategy'));

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  };

  const setSourceNode = (id: number | null) => updateParams({ source_node: id?.toString() ?? null });
  const setTargetNode = (id: number | null) => updateParams({ target_node: id?.toString() ?? null });
  const setStatusValues = (values: StatusValue[]) => updateParams({ status: values.length ? values.join(',') : null });
  const setTriggerTypeValues = (values: TriggerTypeFilterToken[]) =>
    updateParams({ trigger_type: values.length ? values.join(',') : null });
  const setStrategyValues = (values: TracerouteStrategyValue[]) =>
    updateParams({ strategy: values.length ? values.join(',') : null });

  const toggleValue = <T extends string>(current: T[], value: T): T[] =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

  const hasAnyFilter =
    sourceNodeId != null ||
    targetNodeId != null ||
    statusValues.length > 0 ||
    triggerTypeValues.length > 0 ||
    strategyValues.length > 0;

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('source_node');
    next.delete('target_node');
    next.delete('status');
    next.delete('trigger_type');
    next.delete('strategy');
    setSearchParams(next, { replace: true });
  };

  // Successful preset = the status value set used by the old "Success" tab.
  const isSuccessPreset = useMemo(() => {
    if (statusValues.length !== SUCCESS_STATUS_PRESET.length) return false;
    return SUCCESS_STATUS_PRESET.every((s) => statusValues.includes(s));
  }, [statusValues]);

  const isMonitorPreset =
    triggerTypeValues.length === 1 && (triggerTypeValues[0] === '4' || triggerTypeValues[0] === 'monitor');
  const isUserPreset =
    triggerTypeValues.length === 1 && (triggerTypeValues[0] === '1' || triggerTypeValues[0] === 'user');

  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedTracerouteId, setSelectedTracerouteId] = useState<number | null>(null);

  const queryParams = {
    source_node: sourceNodeId ?? undefined,
    target_node: targetNodeId ?? undefined,
    status: statusValues.length ? statusValues.join(',') : undefined,
    trigger_type: triggerTypeValues.length ? triggerTypeValues.join(',') : undefined,
    target_strategy: strategyValues.length ? strategyValues.join(',') : undefined,
    page_size: 50,
  };

  const { traceroutes, totalCount, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTraceroutesInfiniteWithWebSocket(queryParams);

  const { triggerableNodes } = useTracerouteTriggerableNodesSuspense();
  const { managedNodes } = useManagedNodesSuspense({
    pageSize: 500,
    includeStatus: true,
    includeGeoClassification: true,
  });
  const managedByMeshId = useMemo(() => new Map(managedNodes.map((m) => [m.meshtastic_node_id, m])), [managedNodes]);
  const modalManagedNodes = useMemo(
    () =>
      triggerableNodes.map((t) => {
        const full = managedByMeshId.get(t.meshtastic_node_id);
        return full ? { ...t, ...full } : t;
      }),
    [triggerableNodes, managedByMeshId]
  );
  const canTrigger = triggerableNodes.length > 0;
  const { nodes: observedNodes } = useNodesSuspense({
    lastHeardAfter: subDays(new Date(), 7),
    pageSize: 500,
  });
  const triggerMutation = useTriggerTraceroute();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <RouteIcon className="h-6 w-6" />
          Traceroute history
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="default" asChild>
            <Link to="/traceroutes">
              <RouteIcon className="mr-2 h-4 w-4" />
              Statistics
            </Link>
          </Button>
          {canTrigger && (
            <Button size="default" onClick={() => setTriggerModalOpen(true)}>
              <RouteIcon className="mr-2 h-4 w-4" />
              Trigger traceroute
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Traceroutes
            {totalCount != null && <span className="text-sm text-muted-foreground font-normal">({totalCount})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <Select
              value={sourceNodeId != null ? String(sourceNodeId) : 'all'}
              onValueChange={(v) => setSourceNode(v === 'all' ? null : parseInt(v, 10))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Source (sender)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {triggerableNodes.map((n) => (
                  <SelectItem key={n.meshtastic_node_id} value={String(n.meshtastic_node_id)}>
                    {n.short_name ?? n.node_id_str ?? String(n.meshtastic_node_id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchableNodeFilter
              nodes={observedNodes}
              value={targetNodeId}
              onChange={setTargetNode}
              placeholder="Target (recipient)"
              allLabel="All targets"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-[160px] justify-between">
                  {multiSelectLabel(statusValues, STATUS_OPTIONS, 'Status')}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={statusValues.includes(opt.value)}
                    onCheckedChange={() => setStatusValues(toggleValue(statusValues, opt.value))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-[180px] justify-between">
                  {triggerTypeMultiLabel(triggerTypeValues)}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Trigger type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {TRIGGER_TYPE_FILTER_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={triggerTypeValues.includes(opt.value)}
                    onCheckedChange={() =>
                      setTriggerTypeValues(toggleValue(triggerTypeValues, opt.value) as TriggerTypeFilterToken[])
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-[180px] justify-between">
                  {multiSelectLabel(strategyValues, STRATEGY_FILTER_OPTIONS, 'Strategy')}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Strategy</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STRATEGY_FILTER_OPTIONS.map((opt) => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={strategyValues.includes(opt.value)}
                    onCheckedChange={() => setStrategyValues(toggleValue(strategyValues, opt.value))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} title="Clear all filters">
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Presets:</span>
            <Button
              variant={isSuccessPreset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusValues(isSuccessPreset ? [] : SUCCESS_STATUS_PRESET)}
              title="Show traceroutes that succeeded or are still in flight"
            >
              Show successful
            </Button>
            <Button
              variant={isMonitorPreset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTriggerTypeValues(isMonitorPreset ? [] : ['4'])}
              title="Show only monitor-triggered traceroutes"
            >
              Monitoring TRs
            </Button>
            <Button
              variant={isUserPreset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTriggerTypeValues(isUserPreset ? [] : ['1'])}
              title="Show only user-triggered traceroutes"
            >
              Manually triggered
            </Button>
          </div>

          {isLoading && <div className="py-8 text-center text-muted-foreground">Loading...</div>}
          {error && (
            <div className="py-8 text-center text-destructive">
              Failed to load traceroutes: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          )}
          {!isLoading && !error && traceroutes.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">No traceroutes yet.</div>
          )}
          {!isLoading && !error && traceroutes.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Triggered by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead title="Queue due time (pending) or when the command reached the source (sent)">
                      Queue / dispatch
                    </TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead title="Time from triggered to completion (successful runs only)">Elapsed</TableHead>
                    {canTrigger && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traceroutes.map((tr) => (
                    <TableRow
                      key={tr.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTracerouteId(tr.id)}
                    >
                      <TableCell>{tr.source_node?.short_name ?? tr.source_node?.node_id_str ?? '—'}</TableCell>
                      <TableCell>{tr.target_node?.short_name ?? tr.target_node?.node_id_str ?? '—'}</TableCell>
                      <TableCell>{labelForTriggerTypeApi(tr.trigger_type, tr.trigger_type_label)}</TableCell>
                      <TableCell>
                        <StrategyBadge value={tr.target_strategy} />
                      </TableCell>
                      <TableCell>{tr.triggered_by_username ?? '—'}</TableCell>
                      <TableCell>
                        <TracerouteStatusBadge status={tr.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px]">
                        <TracerouteQueueDispatchCell tr={tr} />
                      </TableCell>
                      <TableCell className="max-w-[200px]" title={routeSummary(tr)}>
                        {routeSummary(tr)}
                      </TableCell>
                      <TableCell>{tr.triggered_at ? format(new Date(tr.triggered_at), 'PPp') : '—'}</TableCell>
                      <TableCell
                        title={
                          tr.status !== 'failed' && tr.completed_at
                            ? tr.trigger_type === TRIGGER_TYPE_EXTERNAL
                              ? `Completed ${format(new Date(tr.completed_at), 'PPp')} (start time not recorded)`
                              : format(new Date(tr.completed_at), 'PPp')
                            : undefined
                        }
                      >
                        <TracerouteElapsedCell tr={tr} />
                      </TableCell>
                      {canTrigger && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {triggerableNodes.some((n) => n.meshtastic_node_id === tr.source_node.meshtastic_node_id) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                triggerMutation.mutate(
                                  {
                                    managedNodeId: tr.source_node.meshtastic_node_id!,
                                    targetNodeId: tr.target_node.meshtastic_node_id,
                                    targetStrategy:
                                      tr.target_strategy === 'intra_zone' ||
                                      tr.target_strategy === 'dx_across' ||
                                      tr.target_strategy === 'dx_same_side'
                                        ? tr.target_strategy
                                        : undefined,
                                  },
                                  {
                                    onError: (err) => {
                                      toast.error('Traceroute failed', {
                                        description: getTracerouteErrorMessage(err),
                                      });
                                    },
                                  }
                                )
                              }
                              disabled={triggerMutation.isPending || tr.source_node.allow_auto_traceroute === false}
                              title="Repeat this traceroute"
                              aria-label="Repeat traceroute"
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : hasNextPage ? 'Load more' : 'No more results'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <TracerouteDetailModal
        tracerouteId={selectedTracerouteId}
        open={selectedTracerouteId != null}
        onOpenChange={(open) => !open && setSelectedTracerouteId(null)}
      />

      <TriggerTracerouteModal
        open={triggerModalOpen}
        onOpenChange={setTriggerModalOpen}
        mode={'user' as TriggerMode}
        managedNodes={modalManagedNodes}
        observedNodes={observedNodes}
        onTrigger={async (managedNodeId, targetNodeId, targetStrategy) => {
          try {
            await triggerMutation.mutateAsync({ managedNodeId, targetNodeId, targetStrategy });
            setTriggerModalOpen(false);
          } catch (err) {
            toast.error('Traceroute failed', {
              description: getTracerouteErrorMessage(err),
            });
          }
        }}
        isSubmitting={triggerMutation.isPending}
      />
    </div>
  );
}

interface SearchableNodeFilterProps {
  nodes: ObservedNode[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  allLabel: string;
  className?: string;
}

function SearchableNodeFilter({ nodes, value, onChange, placeholder, allLabel, className }: SearchableNodeFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Defer focus until after the dropdown is rendered.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const selected = value != null ? nodes.find((n) => n.meshtastic_node_id === value) : null;
  const selectedLabel = selected
    ? (selected.short_name ?? selected.node_id_str ?? String(selected.meshtastic_node_id))
    : placeholder;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return nodes.slice(0, 200);
    return nodes
      .filter((n) => {
        const haystack = [n.short_name, n.long_name, n.node_id_str, String(n.meshtastic_node_id)]
          .filter((s): s is string => !!s)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 200);
  }, [nodes, query]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-[200px] justify-between font-normal h-9"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-muted-foreground'}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </Button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+0.25rem)] z-50 w-[260px] rounded-md border border-border bg-popover shadow-lg">
          <div className="p-2 border-b border-border">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search nodes..."
              className="h-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${value == null ? 'bg-accent/50 font-medium' : ''}`}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {allLabel}
              </button>
            </li>
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No nodes match “{query}”</li>
            )}
            {filtered.map((n) => {
              const label = n.short_name ?? n.node_id_str ?? String(n.meshtastic_node_id);
              const isSelected = value === n.meshtastic_node_id;
              return (
                <li key={n.meshtastic_node_id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${isSelected ? 'bg-accent/50 font-medium' : ''}`}
                    onClick={() => {
                      onChange(n.meshtastic_node_id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{label}</span>
                      {n.long_name && n.long_name !== label && (
                        <span className="text-xs text-muted-foreground">{n.long_name}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
