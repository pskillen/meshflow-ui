import { describe, expect, it } from 'vitest';
import {
  assignedFromFeeder,
  assignedOrderKey,
  assignedToApplyEntries,
  formatAssignedMcChannelLabel,
  formatMcChannelDraftLabel,
  newDraftChannel,
  reorderAssigned,
} from './mc-channel-editor';
import type { McChannelSnapshot, MessageChannel, OwnedManagedNode } from '@/lib/models';

describe('mc-channel-editor', () => {
  const catalog: MessageChannel[] = [
    {
      id: 10,
      name: 'Scotland',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 'PUBLIC',
    },
    {
      id: 11,
      name: 'test',
      constellation: 1,
      protocol: 'meshcore',
      mc_channel_type: 'HASHTAG',
      mc_hashtag: 'test',
      display_label: '#test',
    },
  ];

  const feederSnapshots: McChannelSnapshot[] = [
    {
      id: 11,
      mc_channel_idx: 0,
      name: 'test',
      mc_channel_type: 'HASHTAG',
      mc_hashtag: 'test',
    },
  ];

  it('builds assigned rows from feeder mirror', () => {
    const node = {
      mc_channels: feederSnapshots,
    } as OwnedManagedNode;
    expect(assignedFromFeeder(node)).toEqual([{ clientId: 'catalog-11', catalogId: 11 }]);
  });

  it('formats hashtag labels for catalog and draft rows', () => {
    expect(
      formatAssignedMcChannelLabel({ clientId: 'a', catalogId: 11 }, catalog, feederSnapshots)
    ).toBe('#test');
    expect(formatMcChannelDraftLabel(newDraftChannel('HASHTAG', 'mesh'))).toBe('#mesh');
    expect(formatMcChannelDraftLabel(newDraftChannel('PUBLIC', 'Scotland'))).toBe('Scotland');
  });

  it('maps assigned order to apply entries with slot indices', () => {
    const assigned = [
      { clientId: 'd1', draft: newDraftChannel('HASHTAG', 'newtag') },
      { clientId: 'c1', catalogId: 10 },
    ];
    expect(assignedToApplyEntries(assigned, catalog, feederSnapshots)).toEqual([
      {
        mc_channel_idx: 0,
        mc_channel_type: 'HASHTAG',
        name: 'newtag',
        mc_hashtag: 'newtag',
      },
      {
        mc_channel_idx: 1,
        mc_channel_type: 'PUBLIC',
        name: 'Scotland',
        mc_hashtag: null,
      },
    ]);
  });

  it('reorders assigned list', () => {
    const a = { clientId: 'a', catalogId: 1 };
    const b = { clientId: 'b', catalogId: 2 };
    expect(reorderAssigned([a, b], 0, 1)).toEqual([b, a]);
    expect(assignedOrderKey([a, b])).not.toBe(assignedOrderKey([b, a]));
  });
});
