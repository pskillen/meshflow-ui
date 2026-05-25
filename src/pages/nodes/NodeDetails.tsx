import { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NodeDetailContent } from '@/components/nodes/NodeDetailContent';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { useMeshflowApi } from '@/hooks/api/useApi';
import { NodeLookupPicker } from '@/pages/nodes/NodeLookupPicker';
import { isObservedNodeLookupAmbiguous } from '@/lib/observed-node-lookup';

export function NodeDetails() {
  const { id } = useParams<{ id: string }>();
  const { activeTab, onTabChange } = useNodeDetailPageTabs();
  const api = useMeshflowApi();

  const decodedId = (() => {
    if (!id) return '';
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  })();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['observed-node-lookup', decodedId],
    queryFn: () => api.resolveObservedNodeLookup(decodedId),
    enabled: Boolean(decodedId),
    retry: false,
  });

  if (!id) {
    return null;
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No observed node found for id {decodedId}.
        {error instanceof Error && error.message ? (
          <p className="mt-2 text-sm text-muted-foreground/80">{error.message}</p>
        ) : null}
      </div>
    );
  }

  if (data && isObservedNodeLookupAmbiguous(data)) {
    return <NodeLookupPicker lookupId={decodedId} choices={data.ambiguous.choices} />;
  }

  if (!data || data.status !== 'ok') {
    return null;
  }

  const internalId = String(data.node.internal_id);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-teal-500" />
        </div>
      }
    >
      <NodeDetailContent internalId={internalId} activeTab={activeTab} onTabChange={onTabChange} />
    </Suspense>
  );
}
