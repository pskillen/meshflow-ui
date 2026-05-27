import { TextMessage, type PacketObservation, type MeshCoreHeardObservation } from '@/lib/models';
import { messageProtocol } from '@/lib/message-protocol';
import { HeardPathMap } from '@/components/messages/HeardPathMap';
import { isMeshCoreHeardObservation, messageToHeardPathLegs } from '@/components/messages/heard-path-map-adapters';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { memo, useMemo } from 'react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import { nodeDetailPath } from '@/lib/node-detail-routes';

function HeardDialog({
  message,
  size = 'sm',
  className,
}: {
  message: TextMessage;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const observations = message.heard;
  const count = observations?.length || 0;
  const { sender, legs } = useMemo(() => messageToHeardPathLegs(message), [message]);
  const protocol = messageProtocol(message);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            size === 'xs'
              ? `h-6 shrink-0 px-1.5 text-xs font-normal ${className ?? ''}`
              : `h-7 shrink-0 px-2 text-xs font-normal ${className ?? ''}`
          }
          aria-label="Message heard by"
        >
          {count} heard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Heard By</DialogTitle>
        </DialogHeader>
        <HeardPathMap sender={sender} legs={legs} />
        <div className="space-y-4 mt-4">
          {observations?.length ? (
            observations.map((observation, index) => {
              if (protocol === 'meshcore' || isMeshCoreHeardObservation(observation)) {
                const mc = observation as MeshCoreHeardObservation;
                const observerLabel = mc.observer.short_name || mc.observer.node_id_str;
                const observerLink = nodeDetailPath({
                  internal_id: mc.observer.internal_id ?? undefined,
                  node_id_str: mc.observer.node_id_str,
                  protocol: 2,
                });
                return (
                  <div
                    key={`${mc.observer.node_id_str}-${index}`}
                    className="flex items-start space-x-4 p-2 border rounded-md"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">
                        {observerLink ? (
                          <Link to={observerLink} className="hover:underline">
                            {observerLabel}
                          </Link>
                        ) : (
                          observerLabel
                        )}
                      </div>
                      {mc.observer.long_name && (
                        <div className="text-sm text-muted-foreground">{mc.observer.long_name}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(mc.rx_time), 'MMM d, yyyy h:mm a')}
                      </div>
                      {mc.resolved_path && mc.resolved_path.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {mc.resolved_path.map((hop) => (
                            <Badge key={hop.hash} variant="outline" className="font-mono text-xs">
                              {hop.hash}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      {mc.rx_rssi != null && <div>RSSI: {mc.rx_rssi.toFixed(1)}</div>}
                      {mc.rx_snr != null && <div>SNR: {mc.rx_snr.toFixed(1)}</div>}
                    </div>
                  </div>
                );
              }
              const mt = observation as PacketObservation;
              return (
                <div key={mt.observer.meshtastic_node_id} className="flex items-start space-x-4 p-2 border rounded-md">
                  <div className="flex-1">
                    <div className="font-semibold">{mt.observer.short_name || mt.observer.node_id_str}</div>
                    {mt.observer.long_name && (
                      <div className="text-sm text-muted-foreground">{mt.observer.long_name}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(mt.rx_time), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <div className="text-right">
                    {mt.direct_from_sender ? (
                      <div>
                        <Badge variant="secondary">Direct</Badge>
                        {mt.rx_rssi != null && <div className="text-xs mt-1">RSSI: {mt.rx_rssi.toFixed(1)}</div>}
                        {mt.rx_snr != null && <div className="text-xs">SNR: {mt.rx_snr.toFixed(1)}</div>}
                      </div>
                    ) : (
                      <Badge variant="outline">Hop: {mt.hop_count}</Badge>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-muted-foreground">No observation data available</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MessageItemProps {
  message: TextMessage;
  replies?: TextMessage[];
  emojiReactions?: TextMessage[];
  /** Consecutive messages from same sender within 15 min (older, rendered below) */
  continuationMessages?: Array<{ message: TextMessage; replies: TextMessage[]; emojiReactions: TextMessage[] }>;
}

// Memoize the entire component to prevent unnecessary re-renders
export const MessageItem = memo(function MessageItem({
  message,
  replies = [],
  emojiReactions = [],
  continuationMessages = [],
}: MessageItemProps) {
  const proto = messageProtocol(message);
  const senderDetailPath = useMemo(() => {
    if (!message.sender?.node_id_str) {
      return null;
    }
    return nodeDetailPath({
      node_id_str: message.sender.node_id_str,
      protocol: proto === 'meshcore' ? 2 : 1,
    });
  }, [message.sender, proto]);
  const fullTime = useMemo(() => {
    return message.sent_at ? format(new Date(message.sent_at), 'MMM d, yyyy h:mm a') : 'Unknown time';
  }, [message.sent_at]);

  // Group emoji reactions by message_text (the emoji character)
  const emojiCounts = useMemo(() => {
    const map: Record<string, { count: number; senders: string[] }> = {};
    for (const emoji of emojiReactions) {
      const key = emoji.message_text;
      if (!map[key]) map[key] = { count: 0, senders: [] };
      map[key].count++;
      map[key].senders.push(emoji.sender?.short_name || emoji.sender?.node_id_str || 'Unknown');
    }
    return map;
  }, [emojiReactions]);

  const senderName = message.sender?.short_name || message.sender?.node_id_str || 'Anonymous';

  return (
    <article className="mb-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-card p-3">
      {/* Compact single-row header */}
      <header className="flex flex-row items-center gap-2 pb-1.5">
        <Avatar className="h-6 w-6 shrink-0">
          <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-xs">
            {senderName.charAt(0)}
          </div>
        </Avatar>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {/* Desktop: sender name as link. Mobile: sender name + subtle icon link */}
          {senderDetailPath != null ? (
            <>
              <Link
                to={senderDetailPath}
                className="font-medium text-foreground hover:underline truncate md:max-w-[200px]"
              >
                {senderName}
              </Link>
              <Link
                to={senderDetailPath}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground md:sr-only"
                aria-label={`View node ${senderName} details`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <span className="font-medium truncate">{senderName}</span>
          )}
        </div>
        {message.sent_at ? (
          <StaleReportedTime
            at={message.sent_at}
            variant="neutral"
            className="shrink-0 text-xs text-muted-foreground"
            title={fullTime}
          />
        ) : null}
        <HeardDialog message={message} />
      </header>
      <div className="pl-8">
        <p className="whitespace-pre-wrap text-sm">{message.message_text}</p>
        {/* Emoji reactions row */}
        {Object.keys(emojiCounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {Object.entries(emojiCounts).map(([emoji, { count, senders }]) => (
              <Badge key={emoji} variant="secondary" className="text-xs font-normal" title={senders.join(', ')}>
                {emoji} {count > 1 ? count : ''}
              </Badge>
            ))}
          </div>
        )}
        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-2 ml-3 border-l-2 border-muted pl-3 space-y-1">
            {replies.map((reply) => (
              <div key={reply.id} className="text-sm flex flex-wrap items-baseline gap-1.5">
                <span className="font-medium">
                  {reply.sender?.short_name || reply.sender?.node_id_str || 'Unknown'}:
                </span>
                <span>{reply.message_text}</span>
                <span className="text-xs text-muted-foreground">
                  {reply.sent_at ? format(new Date(reply.sent_at), 'MMM d, h:mm a') : ''}
                </span>
                <HeardDialog message={reply} size="xs" />
              </div>
            ))}
          </div>
        )}
        {message.is_emoji && <span className="ml-1 text-xs text-muted-foreground">(emoji)</span>}
        {/* Continuation messages from same sender within 15 min */}
        {continuationMessages.map(({ message: contMsg, replies: contReplies, emojiReactions: contEmoji }) => {
          const contEmojiCounts: Record<string, { count: number; senders: string[] }> = {};
          for (const emoji of contEmoji) {
            const key = emoji.message_text;
            if (!contEmojiCounts[key]) contEmojiCounts[key] = { count: 0, senders: [] };
            contEmojiCounts[key].count++;
            contEmojiCounts[key].senders.push(emoji.sender?.short_name || emoji.sender?.node_id_str || 'Unknown');
          }
          const contTime = contMsg.sent_at ? format(new Date(contMsg.sent_at), 'h:mm a') : '';
          return (
            <div key={contMsg.id} className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
              <p className="whitespace-pre-wrap text-sm">{contMsg.message_text}</p>
              {Object.keys(contEmojiCounts).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Object.entries(contEmojiCounts).map(([emoji, { count, senders }]) => (
                    <Badge key={emoji} variant="secondary" className="text-xs font-normal" title={senders.join(', ')}>
                      {emoji} {count > 1 ? count : ''}
                    </Badge>
                  ))}
                </div>
              )}
              {contMsg.is_emoji && <span className="ml-1 text-xs text-muted-foreground">(emoji)</span>}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{contTime}</span>
                <HeardDialog message={contMsg} size="xs" />
              </div>
              {contReplies.length > 0 && (
                <div className="mt-2 ml-3 border-l-2 border-muted pl-3 space-y-1">
                  {contReplies.map((reply) => (
                    <div key={reply.id} className="text-sm flex flex-wrap items-baseline gap-1.5">
                      <span className="font-medium">
                        {reply.sender?.short_name || reply.sender?.node_id_str || 'Unknown'}:
                      </span>
                      <span>{reply.message_text}</span>
                      <span className="text-xs text-muted-foreground">
                        {reply.sent_at ? format(new Date(reply.sent_at), 'MMM d, h:mm a') : ''}
                      </span>
                      <HeardDialog message={reply} size="xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
});
