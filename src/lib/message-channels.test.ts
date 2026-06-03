import { describe, it, expect } from 'vitest';
import {
  filterChannelsForProtocol,
  formatMessageChannelLabel,
  normalizeMcChannelTypeLabel,
} from './message-channels';
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

  it('derives hashtag label with region scope when display_label is absent', () => {
    const ch: MessageChannel = {
      id: 4,
      name: 'galloway',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 'HASHTAG',
      region_scope: 'sample-west',
    };
    expect(formatMessageChannelLabel(ch)).toBe('#galloway · sample-west');
  });

  it('normalizes mc_channel_type integer to type label', () => {
    expect(normalizeMcChannelTypeLabel(1)).toBe('PUBLIC');
    expect(normalizeMcChannelTypeLabel(2)).toBe('HASHTAG');
    expect(normalizeMcChannelTypeLabel('HASHTAG')).toBe('HASHTAG');
  });

  it('formats hashtag label when mc_channel_type is API integer (2)', () => {
    const ch: MessageChannel = {
      id: 5,
      name: 'galloway',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 2,
      region_scope: 'uk-wide',
    };
    expect(formatMessageChannelLabel(ch)).toBe('#galloway · uk-wide');
  });
});
