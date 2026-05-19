import { useState, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Copy, Plus, Key } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMeshtasticApi } from '@/hooks/api/useApi';
import { useConstellationsSuspense } from '@/hooks/api/useConstellations';
import { useMyManagedNodesSuspense } from '@/hooks/api/useNodes';
import type { NodeApiKey } from '@/lib/models';
import type { OwnedManagedNode } from '@/lib/models';

function ApiKeysContent() {
  const api = useMeshtasticApi();
  const queryClient = useQueryClient();
  const { constellations } = useConstellationsSuspense();
  const { myManagedNodes } = useMyManagedNodesSuspense();

  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [selectedConstellation, setSelectedConstellation] = useState<number | null>(null);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [assignKeyId, setAssignKeyId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignNodes, setSelectedAssignNodes] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toggleKeyId, setToggleKeyId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const { data: apiKeys, isLoading: isLoadingApiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const constellationById = Object.fromEntries(constellations.map((c) => [c.id, c]));
  const getConstellationName = (id: number) => constellationById[id]?.name ?? `Constellation ${id}`;
  const getConstellationColor = (id: number) => constellationById[id]?.map_color ?? '#6b7280';

  const handleCreateApiKey = async () => {
    if (!newApiKeyName || !selectedConstellation) {
      setApiKeyError('Please provide a name and select a constellation');
      return;
    }
    setIsCreatingApiKey(true);
    setApiKeyError(null);
    try {
      await api.createApiKey(newApiKeyName, selectedConstellation);
      setNewApiKeyName('');
      setSelectedConstellation(null);
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (error) {
      setApiKeyError('Failed to create API key. Please try again.');
      console.error('Error creating API key:', error);
    } finally {
      setIsCreatingApiKey(false);
    }
  };

  const openAssignModal = (keyId: string, currentNodes: number[]) => {
    setAssignKeyId(keyId);
    setSelectedAssignNodes(currentNodes);
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignKeyId(null);
    setSelectedAssignNodes([]);
  };

  const handleAssignNodes = async () => {
    if (!assignKeyId) return;
    const apiKey = apiKeys?.find((k) => k.id === assignKeyId);
    if (!apiKey) return;
    setIsAssigning(true);
    try {
      for (const nodeId of selectedAssignNodes) {
        if (!apiKey.nodes.includes(nodeId)) {
          await api.addNodeToApiKey(assignKeyId, nodeId);
        }
      }
      for (const nodeId of apiKey.nodes) {
        if (!selectedAssignNodes.includes(nodeId)) {
          await api.removeNodeFromApiKey(assignKeyId, nodeId);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      closeAssignModal();
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    setDeleteKeyId(keyId);
    setIsDeleting(true);
    try {
      await api.deleteApiKey(keyId);
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } finally {
      setIsDeleting(false);
      setDeleteKeyId(null);
    }
  };

  const handleToggleKey = async (keyId: string, isActive: boolean) => {
    setToggleKeyId(keyId);
    setIsToggling(true);
    try {
      await api.updateApiKey(keyId, { is_active: !isActive });
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } finally {
      setIsToggling(false);
      setToggleKeyId(null);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const assignKey = assignKeyId ? apiKeys?.find((k) => k.id === assignKeyId) : null;
  const assignKeyConstellationId =
    assignKey && typeof assignKey.constellation === 'number'
      ? assignKey.constellation
      : assignKey && typeof assignKey.constellation === 'object' && assignKey.constellation
        ? (assignKey.constellation as { id: number }).id
        : null;
  const nodesForAssignModal =
    assignKeyConstellationId != null
      ? myManagedNodes.filter((n) => n.constellation?.id === assignKeyConstellationId)
      : myManagedNodes;

  return (
    <div className="container mx-auto py-6 space-y-6 px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">API Keys</h1>
        <Link to="/user/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage API Keys</CardTitle>
          <CardDescription>
            <p>
              API keys authenticate bots to report packets and receive commands. Create keys, assign them to managed
              nodes, and deactivate or delete when no longer needed.
            </p>
            <p>
              Bot setup instructions (Docker, .env) are in{' '}
              <Link to="/user/nodes?tab=managed" className="text-primary hover:underline font-medium">
                Node Settings → Managed Nodes
              </Link>{' '}
              - expand a node and click Setup next to each key.
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingApiKeys ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {apiKeys && apiKeys.length > 0 ? (
                  apiKeys.map((apiKey) => (
                    <ApiKeyCard
                      key={apiKey.id}
                      apiKey={apiKey}
                      getConstellationName={getConstellationName}
                      getConstellationColor={getConstellationColor}
                      myManagedNodes={myManagedNodes}
                      onToggle={handleToggleKey}
                      onDelete={handleDeleteKey}
                      onAssignNodes={openAssignModal}
                      onCopy={handleCopyToClipboard}
                      isToggling={isToggling && toggleKeyId === apiKey.id}
                      isDeleting={isDeleting && deleteKeyId === apiKey.id}
                    />
                  ))
                ) : (
                  <Alert>
                    <Key className="h-4 w-4" />
                    <AlertTitle>No API Keys</AlertTitle>
                    <AlertDescription>
                      Create an API key to connect a bot to the Meshflow system. You'll need a managed node first — set
                      one up from{' '}
                      <Link to="/user/nodes" className="text-primary hover:underline">
                        My Nodes
                      </Link>
                      .
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-2">Create New API Key</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a constellation. The key can only be assigned to managed nodes in that constellation.
                </p>
                {apiKeyError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{apiKeyError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label htmlFor="api-key-name" className="block text-sm font-medium mb-1">
                      Name
                    </label>
                    <input
                      id="api-key-name"
                      type="text"
                      className="w-48 p-2 border rounded-md text-sm bg-background"
                      value={newApiKeyName}
                      onChange={(e) => {
                        setNewApiKeyName(e.target.value);
                        setApiKeyError(null);
                      }}
                      placeholder="e.g. Home Node"
                    />
                  </div>
                  <div>
                    <label htmlFor="api-key-constellation" className="block text-sm font-medium mb-1">
                      Constellation
                    </label>
                    <select
                      id="api-key-constellation"
                      className="w-48 p-2 border rounded-md text-sm bg-background"
                      value={selectedConstellation ?? ''}
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) : null;
                        setSelectedConstellation(v);
                        setApiKeyError(null);
                      }}
                    >
                      <option value="">Select constellation</option>
                      {constellations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleCreateApiKey}
                    disabled={isCreatingApiKey || !newApiKeyName || !selectedConstellation}
                  >
                    {isCreatingApiKey ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create Key
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {assignModalOpen && assignKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md border">
            <h3 className="text-lg font-medium mb-2">Assign/Remove Nodes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Key: {assignKey.name} — {getConstellationName(assignKeyConstellationId ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Select managed nodes to assign to this key (same constellation only):
            </p>
            <div className="max-h-48 overflow-y-auto border rounded p-2 mb-4">
              {nodesForAssignModal.length > 0 ? (
                nodesForAssignModal.map((node) => (
                  <div key={node.meshtastic_node_id} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id={`assign-node-${node.meshtastic_node_id}`}
                      checked={selectedAssignNodes.includes(node.meshtastic_node_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssignNodes((prev) => [...prev, node.meshtastic_node_id]);
                        } else {
                          setSelectedAssignNodes((prev) => prev.filter((id) => id !== node.meshtastic_node_id));
                        }
                      }}
                    />
                    <label htmlFor={`assign-node-${node.meshtastic_node_id}`} className="text-sm cursor-pointer">
                      {node.short_name || node.node_id_str}
                    </label>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  No managed nodes in this constellation. Add nodes from{' '}
                  <Link to="/user/nodes" className="text-primary hover:underline">
                    My Nodes
                  </Link>
                  .
                </span>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={closeAssignModal} disabled={isAssigning}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAssignNodes} disabled={isAssigning}>
                {isAssigning ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiKeyCard({
  apiKey,
  getConstellationName,
  getConstellationColor,
  myManagedNodes,
  onToggle,
  onDelete,
  onAssignNodes,
  onCopy,
  isToggling,
  isDeleting,
}: {
  apiKey: NodeApiKey;
  getConstellationName: (id: number) => string;
  getConstellationColor: (id: number) => string;
  myManagedNodes: OwnedManagedNode[];
  onToggle: (keyId: string, isActive: boolean) => Promise<void>;
  onDelete: (keyId: string) => Promise<void>;
  onAssignNodes: (keyId: string, currentNodes: number[]) => void;
  onCopy: (text: string) => void;
  isToggling: boolean;
  isDeleting: boolean;
}) {
  const constellationId =
    typeof apiKey.constellation === 'number'
      ? apiKey.constellation
      : ((apiKey.constellation as { id: number })?.id ?? 0);
  const constellationName = getConstellationName(constellationId);
  const assignedNodeNames = apiKey.nodes
    .map(
      (nid) =>
        myManagedNodes.find((n) => n.meshtastic_node_id === nid)?.short_name ||
        myManagedNodes.find((n) => n.meshtastic_node_id === nid)?.node_id_str ||
        `!${nid.toString(16)}`
    )
    .filter(Boolean);

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-medium">{apiKey.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              style={{ backgroundColor: getConstellationColor(constellationId ?? 0) }}
              className="text-white text-xs"
            >
              {constellationName}
            </Badge>
            <Badge variant={apiKey.is_active ? 'default' : 'destructive'} className="text-xs">
              {apiKey.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {apiKey.last_used
              ? `Last used: ${new Date(apiKey.last_used).toLocaleString()}`
              : `Created: ${new Date(apiKey.created_at).toLocaleString()}`}
          </p>
          {assignedNodeNames.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">Nodes: {assignedNodeNames.join(', ')}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(apiKey.id, apiKey.is_active)}
            disabled={isToggling}
            title={apiKey.is_active ? 'Deactivate' : 'Activate'}
          >
            {apiKey.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAssignNodes(apiKey.id, apiKey.nodes)}>
            Assign/Remove Nodes
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onDelete(apiKey.id)}
            disabled={isDeleting}
            title="Delete"
          >
            Delete
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="bg-muted px-2 py-1 rounded font-mono text-sm truncate max-w-[280px] select-all">
          {apiKey.key}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onCopy(apiKey.key)} className="h-7 px-2">
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
    </div>
  );
}

export function ApiKeysPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ApiKeysContent />
    </Suspense>
  );
}
