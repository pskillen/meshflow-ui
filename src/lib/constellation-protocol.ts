import type { Constellation } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';
import { filterChannelsForProtocol } from '@/lib/message-channels';

/** Constellations that have at least one message channel for the active protocol. */
export function filterConstellationsForProtocol(
  constellations: Constellation[],
  protocol: ProtocolSlug
): Constellation[] {
  return constellations.filter((c) => filterChannelsForProtocol(c.channels ?? [], protocol).length > 0);
}

export function constellationStorageKey(protocol: ProtocolSlug): string {
  return `meshflow-messages-constellation-${protocol}`;
}
