import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageList } from '@/components/messages/MessageList';
import { useConstellationsSuspense } from '@/hooks/api/useConstellations';
import type { MessageChannel } from '@/lib/models';
import type { ProtocolPageConfig } from '@/lib/mesh-protocol';
import { filterChannelsForProtocol, formatMessageChannelLabel } from '@/lib/message-channels';
import { constellationStorageKey, filterConstellationsForProtocol } from '@/lib/constellation-protocol';
import { cn } from '@/lib/utils';

type ProtocolMessageHistoryPageProps = {
  config: ProtocolPageConfig;
};

function readStoredConstellationId(protocol: ProtocolPageConfig['slug']): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(constellationStorageKey(protocol));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function ProtocolMessageHistoryPage({ config }: ProtocolMessageHistoryPageProps) {
  const { constellations: allConstellations } = useConstellationsSuspense();
  const constellations = useMemo(
    () => filterConstellationsForProtocol(allConstellations, config.slug),
    [allConstellations, config.slug]
  );

  const [selectedConstellation, setSelectedConstellation] = useState<number | null>(() => {
    const stored = readStoredConstellationId(config.slug);
    return stored;
  });
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);

  useEffect(() => {
    if (constellations.length === 0) {
      setSelectedConstellation(null);
      setSelectedChannel(null);
      return;
    }
    const stillValid = selectedConstellation != null && constellations.some((c) => c.id === selectedConstellation);
    if (!stillValid) {
      const stored = readStoredConstellationId(config.slug);
      const fromStorage = stored != null && constellations.some((c) => c.id === stored) ? stored : constellations[0].id;
      setSelectedConstellation(fromStorage);
      setSelectedChannel(null);
    }
  }, [constellations, config.slug, selectedConstellation]);

  const channels: MessageChannel[] = useMemo(() => {
    if (!selectedConstellation) {
      return [];
    }
    const constellation = constellations.find((c) => c.id === selectedConstellation);
    const raw = constellation?.channels ?? [];
    return filterChannelsForProtocol(raw, config.slug);
  }, [selectedConstellation, constellations, config.slug]);

  useEffect(() => {
    if (channels.length === 0) {
      setSelectedChannel(null);
      return;
    }
    if (selectedChannel == null || !channels.some((ch) => ch.id === selectedChannel)) {
      setSelectedChannel(channels[0].id);
    }
  }, [channels, selectedChannel]);

  const selectConstellation = (id: number) => {
    setSelectedConstellation(id);
    setSelectedChannel(null);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(constellationStorageKey(config.slug), String(id));
    }
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
                          selectedConstellation === c.id
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
                  <label htmlFor="channel-select" className="mr-2 text-sm font-medium">
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
