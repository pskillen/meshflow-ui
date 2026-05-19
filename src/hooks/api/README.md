# API Hooks

This directory contains React hooks for interacting with the Meshtastic API. These hooks are built using [TanStack Query](https://tanstack.com/query/latest) (formerly React Query) for efficient data fetching, caching, and state management.

## Available Hooks

### Base Hook

- `useMeshtasticApi`: Returns an instance of the MeshtasticApi class for direct API calls.

### Node Hooks

- `useNodes`: Fetches and manages a list of observed nodes with pagination.
- `useNode`: Fetches a single node by ID.
- `useManagedNode`: Fetches a single managed node by ID.
- `useNodeMetrics`: Fetches device metrics for a node.
- `useNodePositions`: Fetches positions for a node.
- `useNodeSearch`: Provides a mutation for searching nodes.
- `useMultiNodeMetrics`: Fetches metrics for multiple nodes in parallel.

### Node Management Hooks

- `useNodeWatches` / `useCreateNodeWatchMutation` / etc.: Mesh monitoring watches (`GET /api/monitoring/watches/`).
- `useRecentNodes`: Manages a list of recently viewed nodes in localStorage.
- `useNodeClaimStatus`: Fetches the claim status of a node.
- `useClaimNode`: Provides a mutation for claiming a node.
- `useCreateManagedNode`: Provides a mutation for creating a managed node from a claimed node.

### Message Hooks

- `useMessages`: Fetches and manages text messages with pagination.
- `useMessage`: Fetches a single message by ID.

### Constellation Hooks

- `useConstellations`: Fetches all constellations.
- `useConstellationChannels`: Fetches channels for a specific constellation.
- `useCreateConstellation`: Provides a mutation for creating a new constellation.
- `useCreateChannel`: Provides a mutation for creating a new channel in a constellation.

### Statistics Hooks

- `usePacketStats`: Fetches packet statistics for global or node-specific data.

## Usage Examples

### Fetching Nodes

```tsx
import { useNodes } from '@/hooks/api';

function NodesList() {
  const { nodes, isLoading, error } = useNodes();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.internal_id}>{node.short_name || node.node_id_str}</li>
      ))}
    </ul>
  );
}
```

### Fetching a Single Node

```tsx
import { useNode } from '@/hooks/api';

function NodeDetail({ nodeId }) {
  const { data: node, isLoading, error } = useNode(nodeId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!node) return <div>Node not found</div>;

  return (
    <div>
      <h2>{node.short_name || node.node_id_str}</h2>
      <p>Node ID: {node.meshtastic_node_id}</p>
      <p>Last heard: {node.last_heard ? new Date(node.last_heard).toLocaleString() : 'Never'}</p>
    </div>
  );
}
```

### Mesh monitoring watches

```tsx
import { useNodeWatches } from '@/hooks/api/useNodeWatches';

function WatchSummary() {
  const { data, isLoading } = useNodeWatches();
  if (isLoading) return <div>Loading…</div>;
  return <p>{data?.count ?? 0} watches</p>;
}
```

## Benefits of This Structure

1. **Centralized API Logic**: All API-related logic is centralized in one place, making it easier to maintain and update.
2. **Efficient Data Fetching**: TanStack Query provides automatic caching, deduplication of requests, and background refetching.
3. **Consistent Error Handling**: Error handling is consistent across all API calls.
4. **Optimized Rendering**: Components only re-render when the data they need changes.
5. **Devtools Integration**: TanStack Query provides devtools for debugging and optimizing queries.
