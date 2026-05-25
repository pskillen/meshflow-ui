import type { MeshProtocol, MessageChannel } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';

/** Normalize API protocol field (number or string) to a route slug; null when absent. */
export function protocolSlugFromApiValue(
  p: MeshProtocol | 'meshtastic' | 'meshcore' | string | null | undefined
): ProtocolSlug | null {
  if (p === undefined || p === null) {
    return null;
  }
  if (typeof p === 'number') {
    return p === 2 ? 'meshcore' : 'meshtastic';
  }
  const slug = String(p).toLowerCase();
  if (slug === 'meshcore' || slug === 'mc' || slug === '2') {
    return 'meshcore';
  }
  if (slug === 'meshtastic' || slug === 'mt' || slug === '1') {
    return 'meshtastic';
  }
  return null;
}

function channelProtocolSlug(ch: MessageChannel): ProtocolSlug | null {
  return protocolSlugFromApiValue(ch.protocol);
}

export function filterChannelsForProtocol(channels: MessageChannel[], protocol: ProtocolSlug): MessageChannel[] {
  return channels.filter((ch) => {
    const slug = channelProtocolSlug(ch);
    if (slug === null) {
      return protocol === 'meshtastic';
    }
    return slug === protocol;
  });
}

export function formatMessageChannelLabel(ch: MessageChannel): string {
  if (ch.mc_channel_idx != null) {
    return `${ch.name} (#${ch.mc_channel_idx})`;
  }
  return ch.name;
}
