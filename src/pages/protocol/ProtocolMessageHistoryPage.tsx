import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageList } from '@/components/messages/MessageList';
import { useConstellationsSuspense } from '@/hooks/api/useConstellations';
import type { MessageChannel } from '@/lib/models';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { filterChannelsForProtocol, formatMessageChannelLabel } from '@/lib/message-channels';

type ProtocolMessageHistoryPageProps = {
  config: ProtocolPageConfig;
};

export function ProtocolMessageHistoryPage({ config }: ProtocolMessageHistoryPageProps) {
  const { constellations } = useConstellationsSuspense();
  const [selectedConstellation, setSelectedConstellation] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);

  useEffect(() => {
    if (constellations.length > 0 && selectedConstellation == null) {
      setSelectedConstellation(constellations[0].id);
    }
  }, [constellations, selectedConstellation]);

  const channels: MessageChannel[] = useMemo(() => {
    if (!selectedConstellation) {
      return [];
    }
    const constellation = constellations.find((c) => c.id === selectedConstellation);
    const raw = constellation?.channels ?? [];
    return filterChannelsForProtocol(raw, config.slug);
  }, [selectedConstellation, constellations, config.slug]);

  useEffect(() => {
    if (channels.length > 0 && selectedChannel == null) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels, selectedChannel]);

  const handleConstellationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedConstellation(Number(e.target.value));
    setSelectedChannel(null);
  };

  const handleChannelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChannel(Number(e.target.value));
  };

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>{config.labels.messagesTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col md:flex-row gap-4 items-center">
            <div>
              <label htmlFor="constellation-select" className="mr-2 font-medium">
                Constellation:
              </label>
              <select
                id="constellation-select"
                value={selectedConstellation ?? ''}
                onChange={handleConstellationSelect}
                disabled={constellations.length === 0}
                className="border rounded px-2 py-1"
              >
                {constellations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="channel-select" className="mr-2 font-medium">
                Channel:
              </label>
              <select
                id="channel-select"
                value={selectedChannel ?? ''}
                onChange={handleChannelSelect}
                disabled={channels.length === 0}
                className="border rounded px-2 py-1"
              >
                {channels.map((ch: MessageChannel) => (
                  <option key={ch.id} value={ch.id}>
                    {formatMessageChannelLabel(ch)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedChannel && selectedConstellation ? (
            <MessageList channel={selectedChannel} constellationId={selectedConstellation} protocol={config.slug} />
          ) : (
            <div className="flex justify-center p-8">No channels available for this constellation.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
