import { TextMessage, type PacketObservation } from '@/lib/models';
import { messageProtocol } from '@/lib/message-protocol';
import { HeardPathGeoMap } from '@/components/messages/HeardPathGeoMap';
import { HeardPathMap } from '@/components/messages/HeardPathMap';
import { MeshCoreHeardPathsPanel } from '@/components/messages/MeshCoreHeardPathsPanel';
import { PathHopChain } from '@/components/messages/PathHopChain';
import {
  isMeshCoreHeardMessage,
  isMeshCoreHeardObservation,
  heardPathSenderForGeoMap,
  meshCoreHeardLegs,
  meshCoreHeardToLegs,
  messageHasAmbiguousPathHops,
  messageToHeardPathLegs,
  resolvedHopsFromObservation,
} from '@/components/messages/heard-path-map-adapters';
import { HopPositionIcon } from '@/components/messages/HopPositionIcon';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { memo, useMemo } from 'react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import { messageSenderDisplay } from '@/lib/message-display-sender';
import { nodeDetailPath } from '@/lib/node-detail-routes';

function MeshCoreHeardDialogBody({ message }: { message: TextMessage }) {
  const { sender, senderDisplayLabel, legs } = useMemo(() => meshCoreHeardLegs(message), [message]);
  const senderKnown = sender?.identified ?? false;
  const senderHasPosition = sender?.position != null;

  const geoFeeders = useMemo(
    () =>
      legs
        .filter((leg) => leg.receiverPosition != null)
        .map((leg) => ({
          label: leg.receiverLabel,
          position: leg.receiverPosition!,
          color: leg.lineColor,
        })),
    [legs]
  );

  const geoSender = heardPathSenderForGeoMap(sender);
  const { legs: pathLegs } = useMemo(() => meshCoreHeardToLegs(message), [message]);
  const hasAmbiguousHops = useMemo(() => messageHasAmbiguousPathHops(message), [message]);

  return (
    <>
      <HeardPathGeoMap
        sender={geoSender}
        feeders={geoFeeders}
        pathLegs={pathLegs}
        senderName={message.mc_sender_label || message.sender?.short_name || message.sender?.long_name || null}
      />
      {message.mc_sender_candidates && message.mc_sender_candidates.length > 1 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Multiple nodes match sender &quot;{message.mc_sender_label}&quot; — map uses feeder positions only.
        </p>
      )}
      <MeshCoreHeardPathsPanel
        legs={legs}
        senderDisplayLabel={senderDisplayLabel}
        senderKnown={senderKnown}
        senderHasPosition={senderHasPosition}
        senderDetailPath={sender?.detailPath ?? null}
        hasAmbiguousHops={hasAmbiguousHops}
      />
      <div className="space-y-4 mt-4">
        {legs.map((leg, index) => {
          const mc = leg.observation;
          const observerLink = nodeDetailPath({
            internal_id: mc.observer.internal_id ?? undefined,
            node_id_str: mc.observer.node_id_str,
            protocol: 2,
          });
          const hops = resolvedHopsFromObservation(mc);
          return (
            <div
              key={`${mc.observer.node_id_str}-${index}`}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 sm:gap-4"
              style={{ borderLeftWidth: 4, borderLeftColor: leg.lineColor }}
            >
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-1.5">
                  <HopPositionIcon positioned={mc.observer.position != null} />
                  {observerLink ? (
                    <Link to={observerLink} className="hover:underline">
                      {leg.receiverLabel}
                    </Link>
                  ) : (
                    leg.receiverLabel
                  )}
                </div>
                {mc.observer.long_name && <div className="text-sm text-muted-foreground">{mc.observer.long_name}</div>}
                <div className="text-xs text-muted-foreground">
                  {format(new Date(mc.rx_time), 'MMM d, yyyy h:mm a')}
                </div>
                <div className="mt-2 text-right text-xs sm:text-left">
                  {mc.rx_rssi != null && <div>RSSI: {mc.rx_rssi.toFixed(1)}</div>}
                  {mc.rx_snr != null && <div>SNR: {mc.rx_snr.toFixed(1)}</div>}
                </div>
              </div>
              <div className="min-w-0 border-t pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                <div className="text-xs font-medium text-muted-foreground mb-1">Path (this feeder)</div>
                <PathHopChain hops={hops} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

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
  const meshCore = isMeshCoreHeardMessage(message);
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
        {meshCore ? (
          <MeshCoreHeardDialogBody message={message} />
        ) : (
          <>
            <HeardPathMap
              sender={sender}
              legs={legs}
              senderName={message.mc_sender_label || message.sender?.short_name || message.sender?.long_name || null}
            />
            <div className="space-y-4 mt-4">
              {observations?.length ? (
                observations.map((observation) => {
                  if (protocol === 'meshcore' || isMeshCoreHeardObservation(observation)) {
                    return null;
                  }
                  const mt = observation as PacketObservation;
                  return (
                    <div
                      key={mt.observer.meshtastic_node_id}
                      className="flex items-start space-x-4 p-2 border rounded-md"
                    >
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
          </>
        )}
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
  const senderDisplay = useMemo(() => messageSenderDisplay(message, proto), [message, proto]);
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

  const senderName = senderDisplay.name;

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
          {senderDisplay.detailPath != null ? (
            <>
              <Link
                to={senderDisplay.detailPath}
                className="font-medium text-foreground hover:underline truncate md:max-w-[200px]"
                title={senderDisplay.title}
              >
                {senderName}
              </Link>
              <Link
                to={senderDisplay.detailPath}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground md:sr-only"
                aria-label={`View node ${senderName} details`}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <span className="font-medium truncate" title={senderDisplay.title}>
              {senderName}
            </span>
          )}
          {senderDisplay.ambiguous && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal" title={senderDisplay.title}>
              {message.mc_sender_candidates?.length} matches
            </Badge>
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
