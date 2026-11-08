import type { ObservedNode } from '@/lib/models';

/** True when `FirmwareBadge` renders something: Meshtastic nodes on an API that exposes the field. */
export function hasFirmwareBadge(node: Pick<ObservedNode, 'protocol' | 'inferred_firmware'>): boolean {
  return node.protocol !== 2 && node.inferred_firmware !== undefined;
}
