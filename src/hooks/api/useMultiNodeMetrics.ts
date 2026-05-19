import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useMeshtasticApi } from './useApi';
import { DeviceMetrics, ObservedNode } from '@/lib/models';
import { DateRangeParams } from '@/lib/types';
import { getKeyValue } from './hooks-utils';
import { roundDateParams } from './hooks-utils';

/**
 * Transform flat bulk response into metricsMap keyed by meshtastic_node_id.
 * Strips meshtastic_node_id, node_id_str, short_name from each item for DeviceMetrics shape.
 */
function bulkResultsToMetricsMap(
  results: Array<DeviceMetrics & { meshtastic_node_id: number; node_id_str?: string; short_name?: string | null }>
): Record<number, DeviceMetrics[]> {
  const map: Record<number, DeviceMetrics[]> = {};
  for (const item of results) {
    const { meshtastic_node_id, ...metric } = item;
    if (!map[meshtastic_node_id]) map[meshtastic_node_id] = [];
    map[meshtastic_node_id].push(metric as DeviceMetrics);
  }
  // Sort each node's metrics by reported_time ascending (for chart ordering)
  for (const nodeId of Object.keys(map)) {
    map[Number(nodeId)].sort((a, b) => {
      const ta = a.reported_time != null ? new Date(a.reported_time).getTime() : 0;
      const tb = b.reported_time != null ? new Date(b.reported_time).getTime() : 0;
      return ta - tb;
    });
  }
  return map;
}

/**
 * Hook to fetch metrics for multiple nodes via bulk endpoint (single request).
 * @param nodes Array of nodes to fetch metrics for
 * @param dateRange Optional date range to filter metrics
 * @returns Object with metricsMap and loading/error states
 */
export function useMultiNodeMetrics(nodes: ObservedNode[], dateRange?: DateRangeParams) {
  const api = useMeshtasticApi();
  const nodeIds = nodes.map((n) => n.meshtastic_node_id);
  const params = roundDateParams(dateRange);
  const keyValue = getKeyValue(params);
  const queryKey = ['nodes', 'metrics-bulk', nodeIds.sort().join(','), keyValue];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const results = await api.getDeviceMetricsBulk(nodeIds, params);
      return bulkResultsToMetricsMap(results);
    },
    enabled: nodeIds.length > 0,
  });

  const metricsMap = query.data ?? Object.fromEntries(nodeIds.map((id) => [id, []]));

  return {
    metricsMap,
    isLoading: query.isLoading,
    isError: query.isError,
    errors: query.error ? [query.error] : [],
  };
}

/**
 * Suspense-enabled hook to fetch metrics for multiple nodes via bulk endpoint.
 * Use inside a <Suspense> boundary. No isLoading or error states are returned.
 */
export function useMultiNodeMetricsSuspense(nodes: ObservedNode[], params?: DateRangeParams) {
  const api = useMeshtasticApi();
  const roundedParams = roundDateParams(params);
  const nodeIds = nodes.map((n) => n.meshtastic_node_id);
  const keyValue = getKeyValue(roundedParams);
  const queryKey = ['nodes', 'metrics-bulk', nodeIds.sort().join(','), keyValue];

  const query = useSuspenseQuery({
    queryKey,
    queryFn: async () => {
      if (nodeIds.length === 0) return {};
      const results = await api.getDeviceMetricsBulk(nodeIds, roundedParams);
      return bulkResultsToMetricsMap(results);
    },
  });

  return {
    metricsMap: (query.data ?? {}) as Record<number, DeviceMetrics[]>,
  };
}
