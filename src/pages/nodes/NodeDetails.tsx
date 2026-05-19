import { Suspense, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NodeDetailContent } from '@/components/nodes/NodeDetailContent';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { useMeshflowApi } from '@/hooks/api/useApi';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function NodeDetails() {
  const { id } = useParams<{ id: string }>();
  const { activeTab, onTabChange } = useNodeDetailPageTabs();

  if (!id) {
    return null;
  }

  if (/^\d+$/.test(id)) {
    return <LegacyMeshtasticNodeRedirect meshtasticNodeId={Number(id)} />;
  }

  if (!UUID_RE.test(id)) {
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
      <NodeDetailContent internalId={id} activeTab={activeTab} onTabChange={onTabChange} />
    </Suspense>
  );
}
