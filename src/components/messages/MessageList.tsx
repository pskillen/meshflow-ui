import { useMemo } from 'react';
import { differenceInMinutes } from 'date-fns';
import { useMessagesWithWebSocket } from '@/hooks/useMessagesWithWebSocket';
import { MessageItem } from './MessageItem';
import { Button } from '@/components/ui/button';
import type { TextMessage } from '@/lib/models';

const CONSECUTIVE_THRESHOLD_MINUTES = 15;

interface MessageListProps {
  channel?: number; // channelId
  constellationId?: number;
  nodeId?: number;
}

export function MessageList({ channel, constellationId, nodeId }: MessageListProps) {
  // Use the WebSocket-enabled hook for fetching messages with real-time updates
  const { messages, fetchNextPage, hasNextPage } = useMessagesWithWebSocket({
    channelId: channel,
    constellationId: constellationId,
    nodeId: nodeId,
    pageSize: 25,
  });

  // Group messages by packet_id for threading and emoji reactions
  const mainMessages = useMemo(() => messages.filter((msg) => !msg.reply_to_meshtastic_packet_id), [messages]);
  const repliesByPacketId = useMemo(() => {
    const map: Record<number, typeof messages> = {};
    for (const msg of messages) {
      if (msg.reply_to_meshtastic_packet_id && !msg.is_emoji) {
        if (!map[msg.reply_to_meshtastic_packet_id]) map[msg.reply_to_meshtastic_packet_id] = [];
        map[msg.reply_to_meshtastic_packet_id].push(msg);
      }
    }
    return map;
  }, [messages]);
  const emojiReactionsByPacketId = useMemo(() => {
    const map: Record<number, typeof messages> = {};
    for (const msg of messages) {
      if (msg.reply_to_meshtastic_packet_id && msg.is_emoji) {
        if (!map[msg.reply_to_meshtastic_packet_id]) map[msg.reply_to_meshtastic_packet_id] = [];
        map[msg.reply_to_meshtastic_packet_id].push(msg);
      }
    }
    return map;
  }, [messages]);

  // Group consecutive messages from same sender within 15 min (messages ordered newest first)
  const messageGroups = useMemo(() => {
    const groups: Array<{ primary: TextMessage; continuations: TextMessage[] }> = [];
    let i = 0;
    while (i < mainMessages.length) {
      const msg = mainMessages[i];
      const continuations: TextMessage[] = [];
      let j = i + 1;
      while (j < mainMessages.length) {
        const next = mainMessages[j];
        const sameSender = next.sender.node_id_str === msg.sender.node_id_str;
        const withinWindow =
          msg.sent_at &&
          next.sent_at &&
          Math.abs(differenceInMinutes(new Date(msg.sent_at), new Date(next.sent_at))) <= CONSECUTIVE_THRESHOLD_MINUTES;
        if (sameSender && withinWindow) {
          continuations.push(next);
          j++;
        } else break;
      }
      groups.push({ primary: msg, continuations });
      i = j; // skip past primary + continuations
    }
    return groups;
  }, [mainMessages]);

  if (mainMessages.length === 0) {
    return <div className="flex justify-center p-8">No messages found.</div>;
  }

  return (
    <div className="space-y-4">
      {messageGroups.map(({ primary, continuations }, index) => (
        <MessageItem
          key={`${primary.id}-${index}`}
          message={primary}
          replies={repliesByPacketId[primary.packet_id] || []}
          emojiReactions={emojiReactionsByPacketId[primary.packet_id] || []}
          continuationMessages={continuations.map((m) => ({
            message: m,
            replies: repliesByPacketId[m.packet_id] || [],
            emojiReactions: emojiReactionsByPacketId[m.packet_id] || [],
          }))}
        />
      ))}

      {hasNextPage && (
        <div className="flex justify-center pb-4 pt-2">
          <Button variant="outline" onClick={() => fetchNextPage()}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
