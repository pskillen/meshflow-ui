import type { McSenderCandidate, TextMessage } from '@/lib/models';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import type { MessageProtocolSlug } from '@/lib/message-protocol';

export type MessageSenderDisplay = {
  name: string;
  detailPath: string | null;
  /** True when multiple ObservedNodes match the parsed channel prefix. */
  ambiguous?: boolean;
  /** Tooltip for ambiguous senders (list of candidate nodes). */
  title?: string;
};

function candidateDisplayName(candidate: McSenderCandidate): string {
  return candidate.short_name || candidate.long_name || candidate.node_id_str;
}

function candidateDetailPath(candidate: McSenderCandidate): string | null {
  return nodeDetailPath({
    internal_id: candidate.internal_id,
    node_id_str: candidate.node_id_str,
    protocol: 2,
  });
}

/** Header label + optional node link for a message row. */
export function messageSenderDisplay(message: TextMessage, proto: MessageProtocolSlug): MessageSenderDisplay {
  if (message.sender?.node_id_str) {
    const name = message.sender.short_name || message.sender.long_name || message.sender.node_id_str;
    return {
      name,
      detailPath: nodeDetailPath({
        node_id_str: message.sender.node_id_str,
        protocol: proto === 'meshcore' ? 2 : 1,
      }),
    };
  }

  if (proto !== 'meshcore') {
    return { name: 'Anonymous', detailPath: null };
  }

  const candidates = message.mc_sender_candidates ?? [];
  const label = message.mc_sender_label?.trim();

  if (candidates.length === 1) {
    const candidate = candidates[0];
    return {
      name: candidateDisplayName(candidate),
      detailPath: candidateDetailPath(candidate),
    };
  }

  if (candidates.length > 1) {
    const heading = label || candidateDisplayName(candidates[0]);
    const names = candidates.map(candidateDisplayName).join(', ');
    return {
      name: heading,
      detailPath: null,
      ambiguous: true,
      title: `${candidates.length} nodes named "${heading}": ${names}`,
    };
  }

  return { name: 'Anonymous', detailPath: null };
}

/** Key for grouping consecutive messages from the same sender. */
export function messageSenderGroupingKey(message: TextMessage, proto: MessageProtocolSlug): string | null {
  if (message.sender?.node_id_str) {
    return message.sender.node_id_str;
  }
  if (proto !== 'meshcore') {
    return null;
  }
  const candidates = message.mc_sender_candidates ?? [];
  if (candidates.length === 1) {
    return candidates[0].node_id_str;
  }
  if (candidates.length > 1 && message.mc_sender_label) {
    return `mc-ambiguous:${message.mc_sender_label.toLowerCase()}`;
  }
  return null;
}
