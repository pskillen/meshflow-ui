import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConstellationChannels } from '@/hooks/api/useConstellations';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import { filterChannelsForProtocol, formatMessageChannelLabel } from '@/lib/message-channels';
import {
  assignedFromFeeder,
  assignedOrderKey,
  assignedToApplyEntries,
  formatAssignedMcChannelLabel,
  newDraftChannel,
  reorderAssigned,
  type AssignedMcChannel,
} from '@/lib/mc-channel-editor';
import type { OwnedManagedNode } from '@/lib/models';
import { cn } from '@/lib/utils';

function applyMcChannelErrorMessage(err: unknown): string {
  const data = (err as { data?: { detail?: string; code?: string } })?.data;
  if (data?.code === 'feeder_bot_not_connected') {
    return data.detail ?? 'Feeder bot is not connected via WebSocket.';
  }
  if (data?.code === 'command_dispatch_unavailable') {
    return data.detail ?? 'Could not dispatch the command (channel layer unavailable).';
  }
  if (data?.detail) {
    return String(data.detail);
  }
  return 'Could not apply channel config to the radio.';
}

let nextClientId = 0;
function newClientId(prefix: string): string {
  nextClientId += 1;
  return `${prefix}-${nextClientId}`;
}

type MeshCoreChannelEditorProps = {
  node: OwnedManagedNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MeshCoreChannelEditor({ node, open, onOpenChange }: MeshCoreChannelEditorProps) {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  const internalId = node.internal_id;
  const constellationId = node.constellation.id;
  const feederSnapshots = node.mc_channels ?? [];

  const { data: constellationChannels = [] } = useConstellationChannels(constellationId);
  const catalog = useMemo(() => filterChannelsForProtocol(constellationChannels, 'meshcore'), [constellationChannels]);

  const [assigned, setAssigned] = useState<AssignedMcChannel[]>(() => assignedFromFeeder(node));
  const [initialOrderKey, setInitialOrderKey] = useState(() => assignedOrderKey(assignedFromFeeder(node)));
  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState<'PUBLIC' | 'HASHTAG'>('PUBLIC');
  const [newNameInput, setNewNameInput] = useState('');
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  useEffect(() => {
    const next = assignedFromFeeder(node);
    setAssigned(next);
    setInitialOrderKey(assignedOrderKey(next));
    setShowNewForm(false);
    setNewNameInput('');
  }, [node]);

  const assignedCatalogIds = useMemo(
    () => new Set(assigned.map((a) => a.catalogId).filter((id): id is number => id != null)),
    [assigned]
  );

  const available = useMemo(
    () => catalog.filter((ch) => !assignedCatalogIds.has(ch.id)),
    [catalog, assignedCatalogIds]
  );

  const orderChanged = assigned.length > 0 && assignedOrderKey(assigned) !== initialOrderKey;

  const applyToRadio = useMutation({
    mutationFn: () => {
      if (!internalId) {
        throw new Error('Missing feeder internal_id');
      }
      return api.applyMcChannelConfig(internalId, assignedToApplyEntries(assigned, catalog, feederSnapshots));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      setConfirmApplyOpen(false);
      onOpenChange(false);
    },
  });

  const assignFromCatalog = (channelId: number) => {
    setAssigned((prev) => [...prev, { clientId: newClientId('catalog'), catalogId: channelId }]);
  };

  const removeAssigned = (index: number) => {
    setAssigned((prev) => prev.filter((_, i) => i !== index));
  };

  const moveAssigned = (index: number, direction: -1 | 1) => {
    setAssigned((prev) => reorderAssigned(prev, index, index + direction));
  };

  const addDraftToAssigned = () => {
    const draft = newDraftChannel(newType, newNameInput);
    if (draft.mc_channel_type === 'HASHTAG' && !draft.mc_hashtag) {
      return;
    }
    setAssigned((prev) => [...prev, { clientId: newClientId('draft'), draft }]);
    setShowNewForm(false);
    setNewNameInput('');
    setNewType('PUBLIC');
  };

  const syncedLabel = node.mc_channels_synced_at
    ? `Last synced from radio: ${new Date(node.mc_channels_synced_at).toLocaleString()}`
    : 'Not synced yet — start the bot with upload enabled to mirror device channels.';

  return (
    <>
      <div className="border rounded-md bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => onOpenChange(!open)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            />
            <span className="truncate">MeshCore channels</span>
          </span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">{assigned.length} on radio</span>
        </button>

        {open ? (
          <div className="space-y-4 border-t border-slate-200/80 dark:border-slate-700/80 px-3 sm:px-4 pb-4 pt-3">
            <p className="text-xs text-muted-foreground">{syncedLabel}</p>
            <p className="text-xs text-muted-foreground">
              Choose channels for this radio, then apply. The feeder bot must be online (WebSocket). New channels are
              created when you apply.
            </p>

            {orderChanged ? (
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100">
                <AlertDescription className="text-xs sm:text-sm">
                  Changing the order or set of channels rewrites device slot indices. The radio&apos;s local channel
                  database may disagree briefly — messages can map to the wrong channel until sync completes.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="flex flex-col min-h-[12rem] rounded-md border border-border bg-background">
                <header className="border-b border-border px-3 py-2">
                  <h4 className="text-sm font-medium">Available</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{node.constellation.name}</p>
                </header>
                <ul className="flex-1 overflow-y-auto p-2 space-y-1 max-h-64 md:max-h-80">
                  {available.length === 0 ? (
                    <li className="text-xs text-muted-foreground px-2 py-3">No more channels to add.</li>
                  ) : (
                    available.map((ch) => (
                      <li key={ch.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2.5 text-left text-sm hover:bg-muted/80 active:bg-muted"
                          onClick={() => assignFromCatalog(ch.id)}
                        >
                          <span className="font-medium truncate">{formatMessageChannelLabel(ch)}</span>
                          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="border-t border-border p-2 space-y-2">
                  {showNewForm ? (
                    <div className="space-y-2 rounded-md bg-muted/40 p-2">
                      <div className="flex gap-2">
                        <Select value={newType} onValueChange={(v) => setNewType(v as 'PUBLIC' | 'HASHTAG')}>
                          <SelectTrigger className="h-9 w-[7.5rem] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PUBLIC">Public</SelectItem>
                            <SelectItem value="HASHTAG">Hashtag</SelectItem>
                          </SelectContent>
                        </Select>
                        {newType === 'HASHTAG' ? (
                          <div className="flex flex-1 min-w-0">
                            <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-2 text-sm text-muted-foreground">
                              #
                            </span>
                            <input
                              className="flex h-9 min-w-0 flex-1 rounded-r-md border border-input bg-background px-2 text-sm"
                              value={newNameInput}
                              onChange={(e) => setNewNameInput(e.target.value)}
                              placeholder="test"
                              aria-label="Hashtag"
                            />
                          </div>
                        ) : (
                          <input
                            className="flex h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                            value={newNameInput}
                            onChange={(e) => setNewNameInput(e.target.value)}
                            placeholder="Channel name"
                            aria-label="Channel name"
                          />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="flex-1" onClick={addDraftToAssigned}>
                          Add to radio
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowNewForm(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New channel
                    </Button>
                  )}
                </div>
              </section>

              <section className="flex flex-col min-h-[12rem] rounded-md border border-border bg-background">
                <header className="border-b border-border px-3 py-2">
                  <h4 className="text-sm font-medium">On this radio</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Top = slot 0</p>
                </header>
                <ul className="flex-1 overflow-y-auto p-2 space-y-1 max-h-64 md:max-h-80">
                  {assigned.length === 0 ? (
                    <li className="text-xs text-muted-foreground px-2 py-3">
                      Tap a channel under Available, or create a new one.
                    </li>
                  ) : (
                    assigned.map((row, index) => (
                      <li
                        key={row.clientId}
                        className="flex items-center gap-1 rounded-md border border-border bg-card pl-2 pr-1 py-1"
                      >
                        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{index}</span>
                        <span className="flex-1 min-w-0 text-sm font-medium truncate py-1.5">
                          {formatAssignedMcChannelLabel(row, catalog, feederSnapshots)}
                          {row.draft ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">(new)</span>
                          ) : null}
                        </span>
                        <div className="flex shrink-0 items-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={index === 0}
                            aria-label="Move up"
                            onClick={() => moveAssigned(index, -1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={index === assigned.length - 1}
                            aria-label="Move down"
                            onClick={() => moveAssigned(index, 1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            aria-label="Remove from radio"
                            onClick={() => removeAssigned(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!internalId || assigned.length === 0}
                onClick={() => setConfirmApplyOpen(true)}
              >
                Apply to radio
              </Button>
              {applyToRadio.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {applyMcChannelErrorMessage(applyToRadio.error)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply channel config to radio?</DialogTitle>
            <DialogDescription>
              This will overwrite your radio&apos;s current channel configuration with the list above. Do you want to
              continue?
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto rounded-md border border-border p-2 bg-muted/30">
            {assigned.map((row, index) => (
              <li key={row.clientId} className="truncate">
                <span className="font-mono text-muted-foreground mr-2">{index}</span>
                {formatAssignedMcChannelLabel(row, catalog, feederSnapshots)}
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setConfirmApplyOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={applyToRadio.isPending} onClick={() => applyToRadio.mutate()}>
              {applyToRadio.isPending ? 'Applying…' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
