import { describe, it, expect } from 'vitest';
import { filterChannelsForProtocol, formatMessageChannelLabel } from './message-channels';
import type { MessageChannel } from '@/lib/models';

describe('message-channels', () => {
  const channels: MessageChannel[] = [
    { id: 1, name: 'MT Primary', constellation: 1, protocol: 'meshtastic' },
    {
      id: 2,
      name: 'test',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 'HASHTAG',
      mc_hashtag: 'test',
      display_label: '#test',
    },
    { id: 3, name: 'Legacy', constellation: 1 },
  ];

  it('filters channels by protocol slug', () => {
    expect(filterChannelsForProtocol(channels, 'meshtastic').map((c) => c.id)).toEqual([1, 3]);
    expect(filterChannelsForProtocol(channels, 'meshcore').map((c) => c.id)).toEqual([2]);
  });

  it('formats MC channel label without device index', () => {
    expect(formatMessageChannelLabel(channels[1])).toBe('#test');
    expect(formatMessageChannelLabel(channels[0])).toBe('MT Primary');
  });

  it('derives hashtag label when display_label is absent', () => {
    const ch: MessageChannel = {
      id: 4,
      name: 'galloway',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 'HASHTAG',
      mc_hashtag: 'galloway',
    };
    expect(formatMessageChannelLabel(ch)).toBe('#galloway');
  });
});
