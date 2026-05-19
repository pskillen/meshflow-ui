import { useState, useEffect } from 'react';
import { ObservedNode } from '@/lib/models';

// Type for storing recent nodes in local storage
interface RecentNode {
  internal_id: number; // internal_id from ObservedNode
  meshtastic_node_id: number; // meshtastic_node_id from ObservedNode
  node_id_str: string; // node_id_str from ObservedNode
  short_name: string | null;
  long_name: string | null;
  viewed_at: string; // ISO string of when the node was viewed
}

const STORAGE_KEY = 'meshtastic-recent-nodes';
const MAX_RECENT_NODES = 10; // Maximum number of recent nodes to store

/**
 * Hook to manage a list of recently viewed nodes in localStorage
 * @returns Object with recentNodes array and addRecentNode method
 */
export function useRecentNodes() {
  const [recentNodes, setRecentNodes] = useState<RecentNode[]>([]);

  // Load recent nodes from local storage on component mount
  useEffect(() => {
    const storedNodes = localStorage.getItem(STORAGE_KEY);
    if (storedNodes) {
      try {
        setRecentNodes(JSON.parse(storedNodes));
      } catch (error) {
        console.error('Failed to parse recent nodes from local storage:', error);
        // If parsing fails, reset the storage
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Save to localStorage whenever recentNodes changes
  useEffect(() => {
    if (recentNodes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentNodes));
    }
  }, [recentNodes]);

  // Add a node to the recent nodes list
  const addRecentNode = (node: ObservedNode | ObservedNode) => {
    setRecentNodes((prevNodes) => {
      // Check if the node already exists with the same ID
      if (prevNodes.some((n) => n.internal_id === node.internal_id)) {
        return prevNodes; // No change needed
      }

      // Create a new node entry
      const newNode: RecentNode = {
        internal_id: node.internal_id,
        meshtastic_node_id: node.meshtastic_node_id,
        node_id_str: node.node_id_str,
        short_name: node.short_name,
        long_name: node.long_name,
        viewed_at: new Date().toISOString(),
      };

      // Remove the node if it already exists in the list
      const filteredNodes = prevNodes.filter((n) => n.internal_id !== node.internal_id);

      // Add the new node at the beginning of the list
      return [newNode, ...filteredNodes]
        .slice(0, MAX_RECENT_NODES)
        .sort((a, b) => (b.short_name ?? b.node_id_str ?? '').localeCompare(a.short_name ?? a.node_id_str ?? ''));
    });
  };

  return {
    recentNodes,
    addRecentNode,
  };
}
