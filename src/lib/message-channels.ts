import type { MeshProtocol, MessageChannel } from '@/lib/models';
import type { ProtocolSlug } from '@/lib/mesh-protocol';
import { formatRegionScopeSuffix } from '@/lib/mc-region-scope';

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

export type McChannelTypeLabel = 'PUBLIC' | 'HASHTAG';

/** Normalize meshflow-api mc_channel_type (integer or wire string) to PUBLIC / HASHTAG. */
export function normalizeMcChannelTypeLabel(
  mcChannelType: string | number | null | undefined
): McChannelTypeLabel | null {
  if (mcChannelType === null || mcChannelType === undefined) {
    return null;
  }
  if (typeof mcChannelType === 'number') {
    if (mcChannelType === 2) {
      return 'HASHTAG';
    }
    if (mcChannelType === 1) {
      return 'PUBLIC';
    }
    return null;
  }
  const t = String(mcChannelType).trim().toUpperCase();
  if (t === 'HASHTAG' || t === '2') {
    return 'HASHTAG';
  }
  if (t === 'PUBLIC' || t === '1') {
    return 'PUBLIC';
  }
  return null;
}

/** MeshCoreChannelType.HASHTAG in meshflow-api (integer or wire string). */
export function isMcHashtagChannelType(mcChannelType: string | number | null | undefined): boolean {
  if (mcChannelType === null || mcChannelType === undefined) {
    return false;
  }
  if (typeof mcChannelType === 'number') {
    return mcChannelType === 2;
  }
  const t = String(mcChannelType).trim().toUpperCase();
  return t === 'HASHTAG' || t === '2';
}

export function formatMcHashtagLabel(tag: string): string {
  const normalized = tag.replace(/^#+/, '').trim();
  return normalized ? `#${normalized}` : '#';
}

function isHashtagChannel(ch: MessageChannel): boolean {
  return isMcHashtagChannelType(ch.mc_channel_type);
}

/** Operator-facing label for Messages / pickers (no device index). */
export function formatMessageChannelLabel(ch: MessageChannel): string {
  if (ch.display_label?.trim()) {
    return ch.display_label.trim();
  }
  const scope = formatRegionScopeSuffix(ch.region_scope);
  if (isHashtagChannel(ch)) {
    const tag = (ch.name ?? '').replace(/^#+/, '').trim();
    if (tag) {
      return `${formatMcHashtagLabel(tag)}${scope}`;
    }
  }
  return `${ch.name}${scope}`;
}
