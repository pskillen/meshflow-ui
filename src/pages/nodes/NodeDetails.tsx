import { Suspense, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NodeDetailContent } from '@/components/nodes/NodeDetailContent';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { useMeshflowApi } from '@/hooks/api/useApi';
import { isObservedNodeInternalId } from '@/lib/node-detail-routes';

function LegacyMeshtasticNodeRedirect({ meshtasticNodeId }: { meshtasticNodeId: number }) {
  const navigate = useNavigate();
  const api = useMeshflowApi();
  const { data, isError } = useQuery({
    queryKey: ['observed-node-resolve', meshtasticNodeId],
    queryFn: async () => {
      const page = await api.getObservedNodes({ protocol: 'meshtastic', page_size: 1000 });
      const match = page.results.find((n) => n.meshtastic_node_id === meshtasticNodeId);
      if (!match) {
        throw new Error('Node not found');
      }
      return match.internal_id;
    },
    retry: false,
  });

  useEffect(() => {
    if (data) {
      navigate(`/nodes/${data}`, { replace: true });
    }
  }, [data, navigate]);

  if (isError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No observed node found for Meshtastic id {meshtasticNodeId}.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
    </div>
  );
}

function NodeIdStrRedirect({ nodeIdStr }: { nodeIdStr: string }) {
  const navigate = useNavigate();
  const api = useMeshflowApi();
  const { data, isError } = useQuery({
    queryKey: ['observed-node-resolve-str', nodeIdStr],
    queryFn: async () => {
      const results = await api.searchNodes(nodeIdStr);
      const exact = results.find((n) => n.node_id_str === nodeIdStr);
      const match = exact ?? results[0];
      if (!match?.internal_id) {
        throw new Error('Node not found');
      }
      return String(match.internal_id);
    },
    retry: false,
  });

  useEffect(() => {
    if (data) {
      navigate(`/nodes/${data}`, { replace: true });
    }
  }, [data, navigate]);

  if (isError) {
    return <div className="p-8 text-center text-muted-foreground">No observed node found for id {nodeIdStr}.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
    </div>
  );
}

export function NodeDetails() {
  const { id } = useParams<{ id: string }>();
  const { activeTab, onTabChange } = useNodeDetailPageTabs();

  if (!id) {
    return null;
  }

  const decodedId = (() => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  })();

  if (/^\d+$/.test(decodedId)) {
    return <LegacyMeshtasticNodeRedirect meshtasticNodeId={Number(decodedId)} />;
  }

  if (decodedId.startsWith('mc:') || decodedId.startsWith('!')) {
    return <NodeIdStrRedirect nodeIdStr={decodedId} />;
  }

  if (!isObservedNodeInternalId(decodedId)) {
    return <div className="p-8 text-center text-muted-foreground">Invalid node id in URL.</div>;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
        </div>
      }
    >
      <NodeDetailContent internalId={decodedId} activeTab={activeTab} onTabChange={onTabChange} />
    </Suspense>
  );
}
