import type { Constellation } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';
import { filterChannelsForProtocol, protocolSlugFromApiValue } from '@/lib/message-channels';

/** Constellations whose protocol and channels match the active protocol route. */
export function filterConstellationsForProtocol(
  constellations: Constellation[],
  protocol: ProtocolSlug
): Constellation[] {
  return constellations.filter((c) => {
    const constellationSlug = protocolSlugFromApiValue(c.protocol);
    if (constellationSlug != null && constellationSlug !== protocol) {
      return false;
    }
    return filterChannelsForProtocol(c.channels ?? [], protocol).length > 0;
  });
}

export function constellationStorageKey(protocol: ProtocolSlug): string {
  return `meshflow-messages-constellation-${protocol}`;
}

/**
 * Pick a constellation id that exists in `constellations` (protocol-filtered list).
 */
export function resolveMessageConstellationId(
  constellations: Constellation[],
  preferredId: number | null,
  protocol: ProtocolSlug
): number | null {
  if (constellations.length === 0) {
    return null;
  }
  if (preferredId != null && constellations.some((c) => c.id === preferredId)) {
    return preferredId;
  }
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(constellationStorageKey(protocol));
    if (raw) {
      const stored = Number(raw);
      if (Number.isFinite(stored) && constellations.some((c) => c.id === stored)) {
        return stored;
      }
    }
  }
  return constellations[0].id;
}
