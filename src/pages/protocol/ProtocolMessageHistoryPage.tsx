import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageList } from '@/components/messages/MessageList';
import { useConstellationsSuspense } from '@/hooks/api/useConstellations';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { MessageChannel } from '@/lib/models';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { filterChannelsForProtocol, formatMessageChannelLabel } from '@/lib/message-channels';
import {
  constellationStorageKey,
  filterConstellationsForProtocol,
  resolveMessageConstellationId,
} from '@/lib/constellation-protocol';
import { cn } from '@/lib/utils';

type ProtocolMessageHistoryPageProps = {
  config: ProtocolPageConfig;
};

function channelUnreadBadgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}

export function ProtocolMessageHistoryPage({ config }: ProtocolMessageHistoryPageProps) {
  const { setActiveMessagesView, markAsReadForChannel, hasUnreadForChannel, unreadCountForChannel } = useWebSocket();
  const { constellations: allConstellations } = useConstellationsSuspense();
  const constellations = useMemo(
    () => filterConstellationsForProtocol(allConstellations, config.slug),
    [allConstellations, config.slug]
  );

  const [selectedConstellation, setSelectedConstellation] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);

  const activeConstellationId = useMemo(
    () => resolveMessageConstellationId(constellations, selectedConstellation, config.slug),
    [constellations, selectedConstellation, config.slug]
  );

  useEffect(() => {
    if (activeConstellationId !== selectedConstellation) {
      setSelectedConstellation(activeConstellationId);
    }
  }, [activeConstellationId, selectedConstellation]);

  const channels: MessageChannel[] = useMemo(() => {
    if (activeConstellationId == null) {
      return [];
    }
    const constellation = constellations.find((c) => c.id === activeConstellationId);
    const raw = constellation?.channels ?? [];
    return filterChannelsForProtocol(raw, config.slug);
  }, [activeConstellationId, constellations, config.slug]);

  useEffect(() => {
    if (channels.length === 0) {
      setSelectedChannel(null);
      return;
    }
    if (selectedChannel == null || !channels.some((ch) => ch.id === selectedChannel)) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels, selectedChannel, activeConstellationId]);

  useEffect(() => {
    if (selectedChannel != null) {
      setActiveMessagesView({ protocol: config.slug, channelId: selectedChannel });
    } else {
      setActiveMessagesView(null);
    }
    return () => setActiveMessagesView(null);
  }, [selectedChannel, config.slug, setActiveMessagesView]);

  const selectConstellation = (id: number) => {
    setSelectedConstellation(id);
    setSelectedChannel(null);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(constellationStorageKey(config.slug), String(id));
    }
  };

  const selectChannel = (channelId: number) => {
    setSelectedChannel(channelId);
    markAsReadForChannel(config.slug, channelId);
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>{config.labels.messagesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {constellations.length === 0 ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              No constellations with {config.labels.section} message channels.
            </div>
          ) : (
            <>
              <div className="mb-4 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Constellation</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Constellation">
                    {constellations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectConstellation(c.id)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm transition-colors',
                          activeConstellationId === c.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:bg-muted'
                        )}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Channel</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Channel">
                    {channels.map((ch: MessageChannel) => {
                      const unreadCount = unreadCountForChannel(config.slug, ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => selectChannel(ch.id)}
                          className={cn(
                            'relative rounded-md border px-3 py-1.5 text-sm transition-colors',
                            selectedChannel === ch.id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:bg-muted'
                          )}
                        >
                          {formatMessageChannelLabel(ch)}
                          {hasUnreadForChannel(config.slug, ch.id) ? (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white shadow-sm ring-2 ring-background">
                              {channelUnreadBadgeLabel(unreadCount)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {selectedChannel != null && activeConstellationId != null ? (
                <MessageList channel={selectedChannel} constellationId={activeConstellationId} protocol={config.slug} />
              ) : (
                <div className="flex justify-center p-8 text-muted-foreground">
                  No channels available for this constellation.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
