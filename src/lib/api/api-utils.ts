import { NodeWatch, ObservedNode } from '../models';

// Helper method to convert ObservedNode to NodeData for backward compatibility
export function parseObservedNodeFromAPI(node: ObservedNode): ObservedNode {
  return {
    ...node,
    meshtastic_node_id: node.meshtastic_node_id ?? 0,
    last_heard: node.last_heard ? new Date(node.last_heard) : null,
    latest_position: node.latest_position
      ? {
          ...node.latest_position,
          logged_time: node.latest_position.logged_time ? new Date(node.latest_position.logged_time) : null,
          reported_time: node.latest_position.reported_time ? new Date(node.latest_position.reported_time) : null,
        }
      : null,
    latest_device_metrics: node.latest_device_metrics
      ? {
          ...node.latest_device_metrics,
          logged_time: node.latest_device_metrics.logged_time ? new Date(node.latest_device_metrics.logged_time) : null,
          reported_time: node.latest_device_metrics.reported_time
            ? new Date(node.latest_device_metrics.reported_time)
            : null,
        }
      : null,
    latest_environment_metrics: node.latest_environment_metrics
      ? {
          ...node.latest_environment_metrics,
          reported_time: node.latest_environment_metrics.reported_time
            ? new Date(node.latest_environment_metrics.reported_time)
            : null,
        }
      : null,
    latest_power_metrics: node.latest_power_metrics
      ? {
          ...node.latest_power_metrics,
          reported_time: node.latest_power_metrics.reported_time
            ? new Date(node.latest_power_metrics.reported_time)
            : null,
        }
      : null,
    battery_alert_confirmed_at:
      node.battery_alert_confirmed_at == null
        ? (node.battery_alert_confirmed_at as null | undefined)
        : new Date(node.battery_alert_confirmed_at as string | Date),
  };
}

/** Parse dates on nested observed_node for mesh monitoring watch API responses. */
export function parseNodeWatchFromAPI(watch: NodeWatch): NodeWatch {
  return {
    ...watch,
    observed_node: parseObservedNodeFromAPI(
      watch.observed_node as unknown as ObservedNode
    ) as NodeWatch['observed_node'],
  };
}
