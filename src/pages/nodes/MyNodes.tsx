import { useState, Suspense, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMyClaimedNodesSuspense, useMyManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useCancelNodeClaim, useDeleteManagedNode } from '@/hooks/api/useNodeClaims';
import { useNodeWatches } from '@/hooks/api/useNodeWatches';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Settings, CheckCircle2 } from 'lucide-react';
import { useConfig } from '@/providers/ConfigProvider';
import { BotSetupInstructions, type BotDefaults } from '@/components/nodes/BotSetupInstructions';
import { ObservedNode, type NodeWatch } from '@/lib/models';
import type { NodeApiKeyConstellation } from '@/lib/models';
import { SetupManagedNode } from '@/components/nodes/SetupManagedNode';
import { NodesMap } from '@/components/nodes/NodesMap';
import { MonitoredNodesBatteryChart } from '@/components/nodes/MonitoredNodesBatteryChart';
import { MyNodeCard } from '@/components/nodes/MyNodeCard';
import { useQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import {
  buildNodesForMap,
  getManagedLiveness,
  groupClaimedNodes,
  observedNodeForManagedRow,
} from '@/lib/my-nodes-grouping';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function hasMapPosition(node: ObservedNode): boolean {
  const lat = node.latest_position?.latitude;
  const lon = node.latest_position?.longitude;
  return lat != null && lon != null && lat !== 0 && lon !== 0;
}

function MyNodesContent() {
  const navigate = useNavigate();
  const config = useConfig();
  const { myClaimedNodes } = useMyClaimedNodesSuspense();
  const { myManagedNodes } = useMyManagedNodesSuspense();
  const [selectedNode, setSelectedNode] = useState<ObservedNode | null>(null);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [error] = useState<string | null>(null);
  const api = useMeshtasticApi();
  const [showInstructionsNode, setShowInstructionsNode] = useState<ObservedNode | null>(null);
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [unclaimTarget, setUnclaimTarget] = useState<ObservedNode | null>(null);
  const [unmanageTarget, setUnmanageTarget] = useState<{ nodeId: number; label: string } | null>(null);
  const cancelClaimMutation = useCancelNodeClaim();
  const deleteManagedMutation = useDeleteManagedNode();
  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const watchesQuery = useNodeWatches();
  const watchesByNodeIdStr = useMemo(() => {
    const m = new Map<string, NodeWatch>();
    for (const w of watchesQuery.data?.results ?? []) {
      m.set(w.observed_node.node_id_str, w);
    }
    return m;
  }, [watchesQuery.data]);

  const managedNodeIds = useMemo(() => new Set(myManagedNodes.map((n) => n.meshtastic_node_id)), [myManagedNodes]);

  const claimedByNodeId = useMemo(() => {
    const m = new Map<number, ObservedNode>();
    for (const c of myClaimedNodes) {
      m.set(c.meshtastic_node_id, c);
    }
    return m;
  }, [myClaimedNodes]);

  const claimedOnlyNodes = useMemo(
    () => myClaimedNodes.filter((n) => !managedNodeIds.has(n.meshtastic_node_id)),
    [myClaimedNodes, managedNodeIds]
  );

  const connectivityBuckets = useMemo(() => groupClaimedNodes(claimedOnlyNodes), [claimedOnlyNodes]);

  const mapNodes = useMemo(() => buildNodesForMap(myClaimedNodes, myManagedNodes), [myClaimedNodes, myManagedNodes]);

  const mapNodesWithPosition = useMemo(() => mapNodes.filter(hasMapPosition), [mapNodes]);

  const hasAnyNodes = myManagedNodes.length > 0 || myClaimedNodes.length > 0;

  const handleRunAsManagedNode = (node: ObservedNode) => {
    setSelectedNode(node);
    setIsSetupDialogOpen(true);
  };

  const handleCloseSetupDialog = () => {
    setIsSetupDialogOpen(false);
    setSelectedNode(null);
  };

  const renderInstructionsModal = () => {
    if (!showInstructionsNode) return null;
    const nodeApiKeys = apiKeys?.filter((key) => key.nodes.includes(showInstructionsNode.meshtastic_node_id)) || [];
    const firstApiKey = nodeApiKeys[0]?.key;
    return (
      <Dialog
        open={instructionsModalOpen}
        onOpenChange={(open) => {
          if (!open) setInstructionsModalOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Managed Node Setup Instructions</DialogTitle>
            <DialogDescription>
              Setup instructions for{' '}
              <span className="font-bold">{showInstructionsNode.short_name || showInstructionsNode.node_id_str}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Node is Managed</AlertTitle>
              <AlertDescription>This node is set up as a managed node.</AlertDescription>
            </Alert>
            {firstApiKey && config ? (
              <BotSetupInstructions
                apiKey={firstApiKey}
                apiBaseUrl={config.apis.meshBot.baseUrl}
                nodeShortName={showInstructionsNode.short_name || showInstructionsNode.node_id_str}
                botDefaults={(() => {
                  const c = nodeApiKeys[0]?.constellation;
                  if (c && typeof c === 'object') {
                    const obj = c as NodeApiKeyConstellation;
                    return {
                      ignorePortnums: obj.bot_default_ignore_portnums ?? undefined,
                      hopLimit: obj.bot_default_hop_limit ?? undefined,
                    } as BotDefaults;
                  }
                  return undefined;
                })()}
              />
            ) : nodeApiKeys.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No API Key Assigned</AlertTitle>
                <AlertDescription>
                  No API key is assigned to this node. Go to Node Settings to assign an API key.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Setup Instructions Unavailable</AlertTitle>
                <AlertDescription>
                  Unable to load configuration. Please try again or check Node Settings.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstructionsModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => navigate(`/nodes/${showInstructionsNode.meshtastic_node_id}`)}>
              Go to Node Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">My Nodes</h1>
        <Button variant="outline" onClick={() => navigate('/user/nodes')} className="flex items-center">
          <Settings className="mr-2 h-4 w-4" />
          Node Settings
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {selectedNode && (
        <SetupManagedNode node={selectedNode} isOpen={isSetupDialogOpen} onClose={handleCloseSetupDialog} />
      )}

      {renderInstructionsModal()}

      <Dialog open={unclaimTarget !== null} onOpenChange={(open) => !open && setUnclaimTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unclaim this node?</DialogTitle>
            <DialogDescription>
              This releases your ownership claim. The node can stay visible as an observed node if the mesh still hears
              it. You can claim it again later if it is unclaimed.
            </DialogDescription>
          </DialogHeader>
          {cancelClaimMutation.isError ? (
            <p className="text-sm text-destructive">Could not unclaim. Try again.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnclaimTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelClaimMutation.isPending}
              onClick={() => {
                if (!unclaimTarget) return;
                cancelClaimMutation.mutate(unclaimTarget.meshtastic_node_id, {
                  onSuccess: () => setUnclaimTarget(null),
                });
              }}
            >
              {cancelClaimMutation.isPending ? 'Unclaiming…' : 'Unclaim node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unmanageTarget !== null} onOpenChange={(open) => !open && setUnmanageTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unmanage this node?</DialogTitle>
            <DialogDescription>
              {unmanageTarget ? (
                <>
                  <span className="font-medium text-foreground">{unmanageTarget.label}</span>
                  {' — '}
                </>
              ) : null}
              Stops this radio from acting as a managed feeder and removes API-key associations for it. Your claim stays
              active; use “Unclaim” separately if you want to release ownership too.
            </DialogDescription>
          </DialogHeader>
          {deleteManagedMutation.isError ? (
            <p className="text-sm text-destructive">Could not unmanage. Try again.</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnmanageTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteManagedMutation.isPending}
              onClick={() => {
                if (!unmanageTarget) return;
                deleteManagedMutation.mutate(unmanageTarget.nodeId, {
                  onSuccess: () => setUnmanageTarget(null),
                });
              }}
            >
              {deleteManagedMutation.isPending ? 'Removing…' : 'Unmanage node'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasAnyNodes ? (
        <>
          {myManagedNodes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Managed nodes</CardTitle>
                <CardDescription>
                  Radios reporting into Meshflow as managed feeders. Open a node for full telemetry, position, and
                  settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {myManagedNodes.map((managed) => {
                    const node = observedNodeForManagedRow(managed, claimedByNodeId.get(managed.meshtastic_node_id));
                    const watch = watchesByNodeIdStr.get(node.node_id_str);
                    const liveness = getManagedLiveness(managed);
                    return (
                      <MyNodeCard
                        key={`managed-${managed.meshtastic_node_id}`}
                        node={node}
                        isManaged
                        isClaimed={node.owner?.id !== undefined}
                        showClaimedBadge={false}
                        managedLiveness={liveness}
                        watch={watch}
                        watchesQuery={watchesQuery}
                        onConvert={() => handleRunAsManagedNode(node)}
                        onShowSetupInstructions={() => {
                          setShowInstructionsNode(node);
                          setInstructionsModalOpen(true);
                        }}
                        onRequestUnmanage={() =>
                          setUnmanageTarget({
                            nodeId: managed.meshtastic_node_id,
                            label: node.short_name || node.node_id_str,
                          })
                        }
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {claimedOnlyNodes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Claimed nodes</CardTitle>
                <CardDescription>
                  Radios you own that are not in the managed list above. Grouped by how recently the mesh last heard
                  them.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <section className="space-y-3" aria-labelledby="my-nodes-online-heading">
                  <h2 id="my-nodes-online-heading" className="text-base font-semibold">
                    Online
                  </h2>
                  {connectivityBuckets.online.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {connectivityBuckets.online.map((node) => {
                        const watch = watchesByNodeIdStr.get(node.node_id_str);
                        return (
                          <MyNodeCard
                            key={node.meshtastic_node_id}
                            node={node}
                            isManaged={false}
                            isClaimed={node.owner?.id !== undefined}
                            showClaimedBadge={false}
                            watch={watch}
                            watchesQuery={watchesQuery}
                            onConvert={() => handleRunAsManagedNode(node)}
                            onShowSetupInstructions={() => {
                              setShowInstructionsNode(node);
                              setInstructionsModalOpen(true);
                            }}
                            onRequestUnclaim={() => setUnclaimTarget(node)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-md border border-dashed px-4 py-6 text-center">
                      No nodes online right now.
                    </p>
                  )}
                </section>

                {connectivityBuckets.recent.length > 0 ? (
                  <section className="space-y-3" aria-labelledby="my-nodes-recent-heading">
                    <h2 id="my-nodes-recent-heading" className="text-base font-semibold">
                      Last heard recently
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {connectivityBuckets.recent.map((node) => {
                        const watch = watchesByNodeIdStr.get(node.node_id_str);
                        return (
                          <MyNodeCard
                            key={node.meshtastic_node_id}
                            node={node}
                            isManaged={false}
                            isClaimed={node.owner?.id !== undefined}
                            showClaimedBadge={false}
                            watch={watch}
                            watchesQuery={watchesQuery}
                            onConvert={() => handleRunAsManagedNode(node)}
                            onShowSetupInstructions={() => {
                              setShowInstructionsNode(node);
                              setInstructionsModalOpen(true);
                            }}
                            onRequestUnclaim={() => setUnclaimTarget(node)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {connectivityBuckets.offline.length > 0 ? (
                  <section className="space-y-3" aria-labelledby="my-nodes-offline-heading">
                    <h2 id="my-nodes-offline-heading" className="text-base font-semibold">
                      Offline
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {connectivityBuckets.offline.map((node) => {
                        const watch = watchesByNodeIdStr.get(node.node_id_str);
                        return (
                          <MyNodeCard
                            key={node.meshtastic_node_id}
                            node={node}
                            isManaged={false}
                            isClaimed={node.owner?.id !== undefined}
                            showClaimedBadge={false}
                            watch={watch}
                            watchesQuery={watchesQuery}
                            onConvert={() => handleRunAsManagedNode(node)}
                            onShowSetupInstructions={() => {
                              setShowInstructionsNode(node);
                              setInstructionsModalOpen(true);
                            }}
                            onRequestUnclaim={() => setUnclaimTarget(node)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <section className="space-y-2" aria-labelledby="my-nodes-map-heading">
            <h2 id="my-nodes-map-heading" className="text-lg font-semibold">
              Your nodes on the map
            </h2>
            <CollapsibleSection title="Map" defaultOpen={false}>
              <div className="space-y-2">
                {mapNodesWithPosition.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1">
                    None of your nodes have a valid GPS position yet. Open a node’s details after it reports position to
                    see it here.
                  </p>
                ) : null}
                <div className="h-[min(600px,70vh)] min-h-[320px] bg-background rounded-lg border">
                  <NodesMap nodes={mapNodes} />
                </div>
              </div>
            </CollapsibleSection>
          </section>

          <section className="space-y-2" aria-labelledby="my-nodes-battery-heading">
            <h2 id="my-nodes-battery-heading" className="text-lg font-semibold">
              Battery trend
            </h2>
            <CollapsibleSection title="Battery chart" defaultOpen={false}>
              <div className="bg-background rounded-lg border">
                <MonitoredNodesBatteryChart nodes={mapNodes} />
              </div>
            </CollapsibleSection>
          </section>
        </>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Nodes</AlertTitle>
          <AlertDescription>
            You don't have any nodes yet. Browse the{' '}
            <Link to="/nodes" className="text-blue-500 hover:text-blue-700">
              nodes list
            </Link>{' '}
            to find and claim a node.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function MyNodes() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <MyNodesContent />
    </Suspense>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="mb-2" aria-expanded={open}>
        {open ? 'Hide' : 'Show'} {title}
      </Button>
      {open && children}
    </div>
  );
}
