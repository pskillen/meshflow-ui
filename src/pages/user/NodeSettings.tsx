import { useState, useEffect, useMemo, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCancelNodeClaim, useDeleteManagedNode, useUserClaims } from '@/hooks/api/useNodeClaims';
import { useConstellationChannels } from '@/hooks/api/useConstellations';
import { useMyManagedNodesSuspense, useMyClaimedNodesSuspense } from '@/hooks/api/useNodes';
import { Badge } from '@/components/ui/badge';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Loader2, AlertCircle, Info, Copy, Radio, HelpCircle, ChevronDown, KeyRound } from 'lucide-react';
import { useConfig } from '@/providers/ConfigProvider';
import { nodeDetailPath, observedNodeDetailPath } from '@/lib/node-detail-routes';
import { BotSetupInstructions } from '@/components/nodes/BotSetupInstructions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ObservedNode,
  type McChannelApplyEntry,
  type McChannelSnapshot,
  type MessageChannel,
  type OwnedManagedNode,
  type NodeApiKey,
} from '@/lib/models';
import { SetupManagedNode } from '@/components/nodes/SetupManagedNode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import { cn } from '@/lib/utils';
// TODO: Add QRCode support for API keys in the future

function NodeSettingsContent() {
  const api = useMeshtasticApi();
  const config = useConfig();
  const { data: claims, isLoading: isLoadingClaims, error: claimsError } = useUserClaims();
  const { myManagedNodes } = useMyManagedNodesSuspense();
  const { myClaimedNodes } = useMyClaimedNodesSuspense();
  const [selectedNode, setSelectedNode] = useState<ObservedNode | null>(null);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [setupInstructionsKey, setSetupInstructionsKey] = useState<{
    apiKey: string;
    nodeShortName: string;
    botDefaults?: { ignorePortnums?: string | null; hopLimit?: number | null };
  } | null>(null);
  const [cancelClaimInternalId, setCancelClaimInternalId] = useState<string | null>(null);
  const [unclaimMyNodesTarget, setUnclaimMyNodesTarget] = useState<ObservedNode | null>(null);
  const [unmanageManagedTarget, setUnmanageManagedTarget] = useState<OwnedManagedNode | null>(null);
  const cancelClaimMutation = useCancelNodeClaim();
  const deleteManagedMutation = useDeleteManagedNode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = ['nodes', 'pending-claims', 'managed'].includes(tabParam ?? '') ? tabParam! : 'nodes';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'nodes') {
      next.delete('tab');
    } else {
      next.set('tab', value);
    }
    setSearchParams(next, { replace: true });
  };

  const handleRunAsManagedNode = (node: ObservedNode) => {
    setSelectedNode(node);
    setIsSetupDialogOpen(true);
  };

  const handleCloseSetupDialog = () => {
    setIsSetupDialogOpen(false);
    setSelectedNode(null);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Create a Set of managed node IDs for quick lookup
  const managedNodeIds = new Set(myManagedNodes.map((n) => n.meshtastic_node_id));

  // Fetch API keys
  const { data: apiKeys, isLoading: isLoadingApiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  return (
    <div className="container mx-auto py-6 space-y-6 px-6">
      <h1 className="text-3xl font-bold mb-6">Node Settings</h1>

      {selectedNode && (
        <SetupManagedNode node={selectedNode} isOpen={isSetupDialogOpen} onClose={handleCloseSetupDialog} />
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4 flex flex-wrap gap-1">
          <TabsTrigger value="nodes">My Nodes</TabsTrigger>
          <TabsTrigger value="pending-claims">Pending Claims</TabsTrigger>
          <TabsTrigger value="managed">Managed Nodes</TabsTrigger>
        </TabsList>

        <TabsContent value="nodes">
          <Card>
            <CardHeader>
              <CardTitle>My Nodes</CardTitle>
              <CardDescription>
                Nodes you own (claimed or admin-assigned). Convert to managed to report packets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myClaimedNodes.length > 0 ? (
                <div className="space-y-4">
                  {myClaimedNodes.map((node) => (
                    <div key={node.meshtastic_node_id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{node.short_name || node.node_id_str}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{node.long_name}</p>
                          <p className="text-xs text-slate-400">Node ID: {node.node_id_str}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Last heard: <StaleReportedTime at={node.last_heard ?? null} fallback="Never" />
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Link
                          to={observedNodeDetailPath(node) ?? '#'}
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          View Node
                        </Link>
                        {!managedNodeIds.has(node.meshtastic_node_id) && (
                          <Button
                            onClick={() => handleRunAsManagedNode(node)}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                          >
                            <Radio className="mr-1 h-3 w-3" />
                            Convert to Managed Node
                          </Button>
                        )}
                        <Button
                          onClick={() => setUnclaimMyNodesTarget(node)}
                          size="sm"
                          variant="outline"
                          className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                        >
                          Unclaim node
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 dark:text-slate-400 py-4">
                  You don't own any nodes yet. Browse the{' '}
                  <Link to="/nodes" className="text-blue-500 hover:text-blue-700 underline">
                    nodes list
                  </Link>{' '}
                  to find and claim one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-claims">
          <Card>
            <CardHeader>
              <CardTitle>Pending Claims</CardTitle>
              <CardDescription>Claims awaiting the claim key message from your node</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingClaims ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
                </div>
              ) : claimsError ? (
                <div className="text-red-500 py-4">Error loading claims: {claimsError.message}</div>
              ) : (
                (() => {
                  const pendingClaims = (claims ?? []).filter((c) => !c.accepted_at);
                  return pendingClaims.length > 0 ? (
                    <div className="space-y-4">
                      {pendingClaims.map((claim) => (
                        <div key={claim.node.meshtastic_node_id} className="border rounded-md p-4">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h3 className="font-medium">{claim.node.short_name || claim.node.node_id_str}</h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{claim.node.long_name}</p>
                              <p className="text-xs text-slate-400">Node ID: {claim.node.node_id_str}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Claimed <StaleReportedTime at={claim.created_at} variant="neutral" className="inline" />
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => setCancelClaimInternalId(claim.node.internal_id)}
                            >
                              Cancel claim
                            </Button>
                          </div>
                          <div className="mt-2">
                            <Link
                              to={`/nodes/${claim.node.internal_id}`}
                              className="text-blue-500 hover:text-blue-700 text-sm"
                            >
                              View Node
                            </Link>
                            <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-medium">Claim Key:</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyToClipboard(claim.claim_key)}
                                  className="h-6 px-2"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <p className="font-mono text-sm mt-1">{claim.claim_key}</p>
                              <Alert className="mt-3">
                                <Info className="h-4 w-4" />
                                <AlertTitle>Claim Instructions</AlertTitle>
                                <AlertDescription className="text-xs">
                                  To complete the claim process, send this key as a direct message from your node to one
                                  of the managed nodes on the network.
                                </AlertDescription>
                              </Alert>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400 py-4">
                      No pending claims. Start a claim from a node's detail page.
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="managed">
          <Card>
            <CardHeader>
              <CardTitle>My Managed Nodes</CardTitle>
              <CardDescription>
                View and manage your monitoring nodes. Expand a node to see API keys and setup instructions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myManagedNodes.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {myManagedNodes.map((node) => {
                    const nodeApiKeys = apiKeys?.filter((key) => key.nodes.includes(node.meshtastic_node_id)) || [];
                    return (
                      <AccordionItem
                        key={node.meshtastic_node_id}
                        value={`node-${node.meshtastic_node_id}`}
                        className="border-2 border-slate-300 dark:border-slate-500 rounded-lg bg-slate-50/80 dark:bg-slate-950/40 shadow-sm"
                      >
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex flex-1 items-center justify-between text-left">
                            <div>
                              <h3 className="font-medium">{node.short_name || node.node_id_str}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge
                                  style={{ backgroundColor: node.constellation.map_color }}
                                  className="text-white text-xs"
                                >
                                  {node.constellation.name}
                                </Badge>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Last heard: <StaleReportedTime at={node.last_heard ?? null} fallback="Never" />
                                </span>
                                {nodeApiKeys.length > 0 && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    • {nodeApiKeys.length} API key{nodeApiKeys.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <ManagedNodeSettings
                            node={node}
                            nodeApiKeys={nodeApiKeys}
                            config={config}
                            isLoadingApiKeys={isLoadingApiKeys}
                            handleCopyToClipboard={handleCopyToClipboard}
                            onShowSetupInstructions={setSetupInstructionsKey}
                            onRequestUnmanage={() => setUnmanageManagedTarget(node)}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Managed Nodes</AlertTitle>
                  <AlertDescription>
                    You haven't set up any managed nodes yet. Go to the "My Nodes" tab to convert an owned node to a
                    managed node.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          {setupInstructionsKey && config && (
            <Dialog open={!!setupInstructionsKey} onOpenChange={(open) => !open && setSetupInstructionsKey(null)}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bot Setup Instructions</DialogTitle>
                </DialogHeader>
                <BotSetupInstructions
                  apiKey={setupInstructionsKey.apiKey}
                  apiBaseUrl={config.apis.meshBot.baseUrl}
                  nodeShortName={setupInstructionsKey.nodeShortName}
                  botDefaults={setupInstructionsKey.botDefaults}
                />
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={unclaimMyNodesTarget !== null} onOpenChange={(open) => !open && setUnclaimMyNodesTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unclaim this node?</DialogTitle>
            <DialogDescription>
              Releases your ownership claim. The node may still appear as observed if the mesh hears it. You can claim
              again later if it is unclaimed.
            </DialogDescription>
          </DialogHeader>
          {cancelClaimMutation.isError ? (
            <p className="text-sm text-destructive">Could not unclaim. Try again.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnclaimMyNodesTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelClaimMutation.isPending}
              onClick={() => {
                if (!unclaimMyNodesTarget) return;
                cancelClaimMutation.mutate(unclaimMyNodesTarget.internal_id, {
                  onSuccess: () => setUnclaimMyNodesTarget(null),
                });
              }}
            >
              {cancelClaimMutation.isPending ? 'Unclaiming…' : 'Unclaim node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unmanageManagedTarget !== null} onOpenChange={(open) => !open && setUnmanageManagedTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unmanage this node?</DialogTitle>
            <DialogDescription>
              Stops this radio from acting as a managed feeder and removes API-key associations. Your claim stays
              active; use “Unclaim” on the My Nodes tab if you also want to release ownership.
            </DialogDescription>
          </DialogHeader>
          {deleteManagedMutation.isError ? (
            <p className="text-sm text-destructive">Could not unmanage. Try again.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnmanageManagedTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteManagedMutation.isPending}
              onClick={() => {
                if (!unmanageManagedTarget) return;
                deleteManagedMutation.mutate(unmanageManagedTarget.meshtastic_node_id, {
                  onSuccess: () => setUnmanageManagedTarget(null),
                });
              }}
            >
              {deleteManagedMutation.isPending ? 'Removing…' : 'Unmanage node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelClaimInternalId !== null} onOpenChange={(open) => !open && setCancelClaimInternalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this claim?</DialogTitle>
            <DialogDescription>
              This withdraws your pending claim before it is accepted. You can start again later from the node page if
              you change your mind.
            </DialogDescription>
          </DialogHeader>
          {cancelClaimMutation.isError && (
            <p className="text-sm text-destructive">Could not cancel the claim. Try again.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelClaimInternalId(null)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelClaimMutation.isPending}
              onClick={() => {
                if (cancelClaimInternalId == null) return;
                cancelClaimMutation.mutate(cancelClaimInternalId, {
                  onSuccess: () => setCancelClaimInternalId(null),
                });
              }}
            >
              {cancelClaimMutation.isPending ? 'Canceling…' : 'Cancel claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function channelMappingsFromNode(node: OwnedManagedNode) {
  return {
    meshtastic_channel_0: node.meshtastic_channel_0?.id ?? null,
    meshtastic_channel_1: node.meshtastic_channel_1?.id ?? null,
    meshtastic_channel_2: node.meshtastic_channel_2?.id ?? null,
    meshtastic_channel_3: node.meshtastic_channel_3?.id ?? null,
    meshtastic_channel_4: node.meshtastic_channel_4?.id ?? null,
    meshtastic_channel_5: node.meshtastic_channel_5?.id ?? null,
    meshtastic_channel_6: node.meshtastic_channel_6?.id ?? null,
    meshtastic_channel_7: node.meshtastic_channel_7?.id ?? null,
  };
}

type ChannelMappings = ReturnType<typeof channelMappingsFromNode>;

const CHANNEL_SLOT_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function countMappedSlots(mappings: ChannelMappings): number {
  return CHANNEL_SLOT_INDEXES.filter((i) => mappings[`meshtastic_channel_${i}` as keyof ChannelMappings] != null)
    .length;
}

function channelMappingsEqual(a: ChannelMappings, b: ChannelMappings): boolean {
  return CHANNEL_SLOT_INDEXES.every((i) => {
    const k = `meshtastic_channel_${i}` as keyof ChannelMappings;
    return a[k] === b[k];
  });
}

function stripHashtagPrefix(value: string): string {
  return value.replace(/^#+/, '').trim();
}

function mcChannelsFromNode(node: OwnedManagedNode): McChannelApplyEntry[] {
  return (node.mc_channels ?? []).map((ch) => ({
    mc_channel_idx: ch.mc_channel_idx,
    name: ch.name,
    mc_channel_type: ch.mc_channel_type,
    mc_hashtag: ch.mc_channel_type === 'HASHTAG' ? (ch.mc_hashtag ?? stripHashtagPrefix(ch.name)) : ch.mc_hashtag,
  }));
}

function applyMcChannelErrorMessage(err: unknown): string {
  const data = (err as { data?: { detail?: string; code?: string } })?.data as
    | { detail?: string; code?: string }
    | undefined;
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

function MeshCoreChannelSettings({ node }: { node: OwnedManagedNode }) {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  const internalId = node.internal_id;
  const [rows, setRows] = useState<McChannelApplyEntry[]>(() => mcChannelsFromNode(node));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setRows(mcChannelsFromNode(node));
  }, [node]);

  const applyToRadio = useMutation({
    mutationFn: () => {
      if (!internalId) {
        throw new Error('Missing feeder internal_id');
      }
      return api.applyMcChannelConfig(internalId, rows);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      setOpen(false);
    },
  });

  const updateRow = (index: number, patch: Partial<McChannelApplyEntry>) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (next.mc_channel_type === 'HASHTAG') {
          const tag = stripHashtagPrefix(next.mc_hashtag ?? next.name);
          return { ...next, name: tag, mc_hashtag: tag || null };
        }
        return { ...next, mc_hashtag: null };
      })
    );
  };

  const addRow = () => {
    const used = new Set(rows.map((r) => r.mc_channel_idx));
    let idx = 0;
    while (used.has(idx) && idx < 63) idx += 1;
    setRows((prev) => [
      ...prev,
      { mc_channel_idx: idx, name: `Channel ${idx}`, mc_channel_type: 'PUBLIC', mc_hashtag: null },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const syncedLabel = node.mc_channels_synced_at
    ? `Last synced from radio: ${new Date(node.mc_channels_synced_at).toLocaleString()}`
    : 'Not synced yet — start the bot with upload enabled to mirror device channels.';

  return (
    <div className="border rounded-md bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
          <span className="truncate">MeshCore channels</span>
        </span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {(node.mc_channels ?? []).length} on radio
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-200/80 dark:border-slate-700/80 px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">{syncedLabel}</p>
          <p className="text-xs text-muted-foreground">
            The radio is the source of truth. Edits here are sent to the device when you apply; the bot re-syncs the API
            mirror afterward. The feeder bot must be online (WebSocket).
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No channels in the API mirror yet.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={`${row.mc_channel_idx}-${index}`} className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Index</Label>
                    <p className="text-sm font-mono">{row.mc_channel_idx}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={row.mc_channel_type}
                      onValueChange={(v) => {
                        const type = v as McChannelSnapshot['mc_channel_type'];
                        if (type === 'HASHTAG') {
                          const tag = stripHashtagPrefix(row.mc_hashtag ?? row.name);
                          updateRow(index, {
                            mc_channel_type: type,
                            name: tag,
                            mc_hashtag: tag || null,
                          });
                        } else {
                          updateRow(index, { mc_channel_type: type, mc_hashtag: null });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLIC">Public</SelectItem>
                        <SelectItem value="HASHTAG">Hashtag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.mc_channel_type === 'HASHTAG' ? (
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Hashtag</Label>
                      <div className="flex">
                        <span
                          className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground"
                          aria-hidden
                        >
                          #
                        </span>
                        <input
                          className="flex h-9 w-full rounded-r-md border border-input bg-background px-3 text-sm"
                          value={row.mc_hashtag ?? ''}
                          onChange={(e) => updateRow(index, { mc_hashtag: e.target.value })}
                          placeholder="galloway"
                          aria-label="Hashtag name"
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Stored on the radio as #{row.mc_hashtag || '…'} (name and hashtag are the same).
                      </p>
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Name</Label>
                      <input
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={row.name}
                        onChange={(e) => updateRow(index, { name: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              Add channel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!internalId || applyToRadio.isPending || rows.length === 0}
              onClick={() => applyToRadio.mutate()}
            >
              {applyToRadio.isPending ? 'Applying…' : 'Apply to radio'}
            </Button>
            {applyToRadio.isError && (
              <span className="text-sm text-destructive" role="alert">
                {applyMcChannelErrorMessage(applyToRadio.error)}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ManagedNodeSettings({
  node,
  nodeApiKeys,
  config,
  isLoadingApiKeys,
  handleCopyToClipboard,
  onShowSetupInstructions,
  onRequestUnmanage,
}: {
  node: OwnedManagedNode;
  nodeApiKeys: NodeApiKey[];
  config: ReturnType<typeof useConfig>;
  isLoadingApiKeys: boolean;
  handleCopyToClipboard: (text: string) => void;
  onShowSetupInstructions: (
    params: {
      apiKey: string;
      nodeShortName: string;
      botDefaults?: { ignorePortnums?: string | null; hopLimit?: number | null };
    } | null
  ) => void;
  onRequestUnmanage?: () => void;
}) {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  const constellationId = node.constellation.id;
  const { data: constellationChannels = [], isLoading: channelsLoading } = useConstellationChannels(constellationId);

  const [mappings, setMappings] = useState<ChannelMappings>(() => channelMappingsFromNode(node));
  const [channelMapOpen, setChannelMapOpen] = useState(false);

  useEffect(() => {
    setMappings(channelMappingsFromNode(node));
  }, [node]);

  const savedMappings = useMemo(() => channelMappingsFromNode(node), [node]);
  const isChannelMapDirty = !channelMappingsEqual(mappings, savedMappings);

  const saveChannels = useMutation({
    mutationFn: () =>
      api.patchManagedNode(node.meshtastic_node_id, {
        meshtastic_channel_0: mappings.meshtastic_channel_0,
        meshtastic_channel_1: mappings.meshtastic_channel_1,
        meshtastic_channel_2: mappings.meshtastic_channel_2,
        meshtastic_channel_3: mappings.meshtastic_channel_3,
        meshtastic_channel_4: mappings.meshtastic_channel_4,
        meshtastic_channel_5: mappings.meshtastic_channel_5,
        meshtastic_channel_6: mappings.meshtastic_channel_6,
        meshtastic_channel_7: mappings.meshtastic_channel_7,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-nodes', 'mine'] });
      setChannelMapOpen(false);
    },
  });

  const setSlot = (index: number, raw: string) => {
    const v = raw === 'none' ? null : Number(raw);
    setMappings((prev) => ({ ...prev, [`meshtastic_channel_${index}`]: v }) as ChannelMappings);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap gap-2">
        <Link
          to={
            nodeDetailPath({
              internal_id: node.internal_id,
              meshtastic_node_id: node.meshtastic_node_id,
              node_id_str: node.node_id_str,
              protocol: node.protocol,
            }) ?? '#'
          }
        >
          <Button variant="outline" size="sm">
            View Node Details
          </Button>
        </Link>
        {onRequestUnmanage != null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => onRequestUnmanage()}
          >
            Unmanage node
          </Button>
        ) : null}
      </div>

      {node.protocol === 2 ? <MeshCoreChannelSettings node={node} /> : null}

      {node.protocol !== 2 ? (
        <div className="border rounded-md bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
          <button
            type="button"
            aria-expanded={channelMapOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
            onClick={() => setChannelMapOpen((o) => !o)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  channelMapOpen && 'rotate-180'
                )}
              />
              <span className="truncate">Meshtastic channel mapping</span>
            </span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {countMappedSlots(mappings)} / 8 mapped
              {isChannelMapDirty ? ' · unsaved' : ''}
            </span>
          </button>
          {channelMapOpen ? (
            <div className="space-y-3 border-t border-slate-200/80 dark:border-slate-700/80 px-4 pb-4 pt-3">
              <p className="text-xs text-muted-foreground">
                Map each radio slot (0–7) to a message channel in{' '}
                <span className="font-medium">{node.constellation.name}</span>. Used to attribute packets and text from
                this node.
              </p>
              {channelsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500 dark:text-slate-400" />
                </div>
              ) : constellationChannels.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No channels in this constellation</AlertTitle>
                  <AlertDescription className="text-xs">
                    Add message channels to the constellation first, or continue with all slots unmapped.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    {CHANNEL_SLOT_INDEXES.map((i) => {
                      const slotKey = `meshtastic_channel_${i}` as keyof ChannelMappings;
                      const cur = mappings[slotKey];
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <Label
                            htmlFor={`managed-ch-${node.meshtastic_node_id}-${i}`}
                            className="w-24 shrink-0 text-sm"
                          >
                            Slot {i}
                          </Label>
                          <Select value={cur == null ? 'none' : String(cur)} onValueChange={(v) => setSlot(i, v)}>
                            <SelectTrigger id={`managed-ch-${node.meshtastic_node_id}-${i}`} className="flex-1">
                              <SelectValue placeholder="Unmapped" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (unmapped)</SelectItem>
                              {constellationChannels.map((ch: MessageChannel) => (
                                <SelectItem key={ch.id} value={String(ch.id)}>
                                  {ch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      disabled={saveChannels.isPending}
                      onClick={() => saveChannels.mutate()}
                    >
                      {saveChannels.isPending ? 'Saving…' : 'Save channel mappings'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isChannelMapDirty || saveChannels.isPending}
                      onClick={() => {
                        setMappings(savedMappings);
                        saveChannels.reset();
                      }}
                    >
                      Revert
                    </Button>
                    {saveChannels.isError && (
                      <span className="text-sm text-destructive">Could not save. Try again.</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">API Keys</p>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Create keys and attach them to this node on the API Keys page. Keys must belong to the same constellation
              as this node.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-2 border-slate-300 dark:border-slate-600"
            asChild
          >
            <Link to="/user/api-keys">
              <KeyRound className="h-3.5 w-3.5 opacity-80" />
              Manage API keys
            </Link>
          </Button>
        </div>
        {isLoadingApiKeys ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500 dark:text-slate-400" />
          </div>
        ) : nodeApiKeys.length > 0 ? (
          <div className="space-y-4">
            {nodeApiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="border border-slate-200 dark:border-slate-700 rounded-md p-4 bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-sm">{apiKey.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {apiKey.last_used
                        ? `Last used: ${new Date(apiKey.last_used).toLocaleString()}`
                        : `Created: ${new Date(apiKey.created_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={apiKey.is_active ? 'default' : 'destructive'} className="text-xs">
                      {apiKey.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {config && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onShowSetupInstructions({
                            apiKey: apiKey.key,
                            nodeShortName: node.short_name || node.node_id_str,
                            botDefaults: node.constellation
                              ? {
                                  ignorePortnums:
                                    node.constellation.bot_default_ignore_meshtastic_portnums ?? undefined,
                                  hopLimit: node.constellation.bot_default_meshtastic_hop_limit ?? undefined,
                                }
                              : undefined,
                          })
                        }
                        title="Setup instructions"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Bot setup instructions
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-medium">Key:</span>
                  <span className="bg-slate-100 dark:bg-slate-800 p-2 rounded font-mono text-sm truncate select-all max-w-[200px]">
                    {apiKey.key}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(apiKey.key)}
                    className="h-7 px-2"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No API Key Assigned</AlertTitle>
            <AlertDescription>
              Go to{' '}
              <Link to="/user/api-keys" className="text-primary hover:underline font-medium">
                API Keys
              </Link>{' '}
              to create a key and assign it to this node.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

export function NodeSettings() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <NodeSettingsContent />
    </Suspense>
  );
}
