import type { MessageChannel } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';

function channelProtocolSlug(ch: MessageChannel): ProtocolSlug | null {
  const p = ch.protocol;
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
