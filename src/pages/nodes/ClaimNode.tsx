import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNodeSuspense, useManagedNodesSuspense } from '@/hooks/api/useNodes';
import { useMeshflowApi } from '@/hooks/api/useApi';
import { useNodeClaimWebSocket } from '@/hooks/useNodeClaimWebSocket';
import { ConstellationsMap } from '@/components/nodes/ConstellationsMap';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { NodeClaim } from '@/lib/models';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { filterManagedNodesForMapDisplay } from '@/lib/managed-node-status';
import {
  filterManagedNodesForClaim,
  meshProtocolFromObservedNode,
  MESHCORE_CONFIG,
  MESHTASTIC_CONFIG,
} from '@/lib/mesh-protocol';
import { observedNodeDetailPath } from '@/lib/node-detail-routes';

const FALLBACK_POLL_MS = 30_000;

export function ClaimNode() {
  const { id } = useParams<{ id: string }>();
  const routeId = id ?? '';
  const navigate = useNavigate();
  const api = useMeshflowApi();
  const queryClient = useQueryClient();

  const [claimKey, setClaimKey] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<NodeClaim | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const node = useNodeSuspense(routeId);
  const claimProtocol = meshProtocolFromObservedNode(node);
  const meshCore = claimProtocol === 2;
  const protocolConfig = meshCore ? MESHCORE_CONFIG : MESHTASTIC_CONFIG;
  const lookupId = node.internal_id ?? routeId;
  const detailPath = observedNodeDetailPath(node) ?? `/nodes/${routeId}`;

  const { managedNodes } = useManagedNodesSuspense({ includeStatus: true });
  const feedersForClaim = useMemo(
    () => filterManagedNodesForClaim(managedNodes ?? [], claimProtocol),
    [managedNodes, claimProtocol]
  );
  const managedNodesForMap = useMemo(() => filterManagedNodesForMapDisplay(feedersForClaim), [feedersForClaim]);
  const isLoadingManagedNodes = !managedNodes;

  const handleClaimAccepted = useCallback(
    (acceptedAt: string) => {
      setClaimStatus((prev) => (prev ? { ...prev, accepted_at: acceptedAt } : prev));
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: ['nodes', lookupId, 'claim'] });
      queryClient.invalidateQueries({ queryKey: ['nodes', lookupId] });
      queryClient.invalidateQueries({ queryKey: ['observed-nodes', 'mine'] });
      setTimeout(() => navigate(detailPath), 3000);
    },
    [detailPath, lookupId, navigate, queryClient]
  );

  const claimPending = claimStatus !== undefined && !claimStatus.accepted_at;

  const { wsConnected } = useNodeClaimWebSocket({
    nodeInternalId: lookupId,
    nodeIdStr: node.node_id_str,
    enabled: claimPending,
    onAccepted: (event) => handleClaimAccepted(event.accepted_at),
  });

  const checkClaimStatus = useCallback(async () => {
    try {
      const status = await api.getClaimStatus(lookupId);
      setClaimStatus(status);
      if (status?.accepted_at) {
        handleClaimAccepted(status.accepted_at);
      }
    } catch (err) {
      console.error('Error checking claim status:', err);
    }
  }, [api, handleClaimAccepted, lookupId]);

  const startStatusPolling = useCallback(() => {
    checkClaimStatus();
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(checkClaimStatus, FALLBACK_POLL_MS);
  }, [checkClaimStatus]);

  useEffect(() => {
    let cancelled = false;
    async function checkInitialClaim() {
      try {
        const status = await api.getClaimStatus(lookupId);
        if (cancelled) return;
        if (status) {
          setClaimStatus(status);
          setClaimKey(status.claim_key);
          if (!status.accepted_at) {
            startStatusPolling();
          } else {
            handleClaimAccepted(status.accepted_at);
          }
        }
      } catch {
        // user can still initiate claim
      }
    }
    checkInitialClaim();
    return () => {
      cancelled = true;
    };
  }, [api, handleClaimAccepted, lookupId, startStatusPolling]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const initiateNodeClaim = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.claimNode(lookupId);
      setClaimKey(response.claim_key);
      setClaimStatus(response);
      startStatusPolling();
    } catch (err) {
      setError('Failed to initiate claim. Please try again.');
      console.error('Error claiming node:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (node.owner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Already Claimed</AlertTitle>
          <AlertDescription>
            This node is already claimed by {node.owner.username}. You will be redirected to the node details page.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate(detailPath)}>Go to Node Details</Button>
      </div>
    );
  }

  const instructionSteps = meshCore
    ? [
        'On your MeshCore device, open a contact (DM) to one of the MeshCore feeders listed below — not a channel/broadcast message.',
        'Send a message that contains only the claim key shown above.',
        'This page will update automatically when the feeder receives your message.',
      ]
    : [
        'Send a direct message from your Meshtastic node to one of the managed nodes shown on the map below.',
        'The message should contain only the claim key shown above.',
        'This page will update automatically when a managed node receives your message.',
      ];

  return (
    <div className="container mx-auto px-4 py-8">
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Link to={detailPath} replace={true} className="text-blue-500 hover:text-blue-700 mb-4 inline-block">
        ← Back to Node Details
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          Claim {protocolConfig.labels.section} Node: {node.short_name}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">{node.long_name}</p>
      </div>

      {claimStatus === undefined ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Claim This Node</CardTitle>
            <CardDescription>
              Claiming this node will associate it with your account, allowing you to manage it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Node ID: <span className="font-medium">{node.node_id_str}</span>
            </p>
            <p className="mb-4">
              Last Heard:{' '}
              <span className="font-medium">
                <StaleReportedTime at={node.last_heard ?? null} fallback="Never" className="font-medium" />
              </span>
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={initiateNodeClaim} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initiating Claim...
                </>
              ) : (
                'Claim Node'
              )}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <>
          {claimKey && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Claim Key Generated</CardTitle>
                <CardDescription>Use this key to complete the claim process</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-md mb-4">
                  <p className="text-xl font-mono text-center">{claimKey}</p>
                </div>

                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Instructions</AlertTitle>
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-2 mt-2">
                      {instructionSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{claimStatus.accepted_at ? 'Claim Complete' : 'Claim In Progress'}</CardTitle>
              <CardDescription>
                {claimStatus.accepted_at
                  ? 'Your node has been successfully claimed. You will be redirected to the node details page.'
                  : `Waiting for your ${meshCore ? 'contact message' : 'direct message'} to reach a ${protocolConfig.labels.section} feeder.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {claimPending && (
                <p className="text-xs text-muted-foreground mb-3">
                  {wsConnected ? 'Live updates connected' : 'Checking periodically (live updates unavailable)'}
                </p>
              )}
              <Alert
                className={
                  claimStatus.accepted_at
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
                }
              >
                {claimStatus.accepted_at ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <AlertTitle>{claimStatus.accepted_at ? 'Claim Successful!' : 'Waiting for Claim Message'}</AlertTitle>
                <AlertDescription>
                  {claimStatus.accepted_at
                    ? 'Your node has been successfully claimed. You will be redirected to the node details page.'
                    : `Send the claim key from your ${protocolConfig.labels.section} node to a feeder below.`}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{protocolConfig.labels.managedNodesTitle}</CardTitle>
              <CardDescription>
                Send your claim message to one of these {protocolConfig.labels.section} feeders
                {meshCore ? (
                  <>
                    {' '}
                    (
                    <Link to={protocolConfig.routes.managedNodes} className="text-teal-600 hover:underline">
                      view all
                    </Link>
                    )
                  </>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingManagedNodes ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : feedersForClaim.length > 0 ? (
                <div className="mb-4">
                  <div className="h-[400px] w-full">
                    <ConstellationsMap nodes={managedNodesForMap} />
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No {protocolConfig.labels.section} Feeders</AlertTitle>
                  <AlertDescription>
                    There are no {protocolConfig.labels.section} managed nodes available to receive your claim message.
                    {meshCore ? (
                      <>
                        {' '}
                        See{' '}
                        <Link to={protocolConfig.routes.managedNodes} className="text-teal-600 hover:underline">
                          MeshCore managed nodes
                        </Link>
                        .
                      </>
                    ) : null}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
