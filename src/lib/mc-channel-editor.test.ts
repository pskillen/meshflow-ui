import { describe, expect, it } from 'vitest';
import {
  assignedFromFeeder,
  assignedMcChannelRowDisplay,
  assignedOrderKey,
  assignedToApplyEntries,
  formatAssignedMcChannelLabel,
  formatMcChannelDraftLabel,
  messageChannelRowDisplay,
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
      region_scope: 'sample-west',
      display_label: '#test · sample-west',
    },
  ];

  const feederSnapshots: McChannelSnapshot[] = [
    {
      id: 11,
      mc_channel_idx: 0,
      name: 'test',
      mc_channel_type: 'HASHTAG',
      region_scope: 'sample-west',
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
    ).toBe('#test · sample-west');
    expect(formatMcChannelDraftLabel(newDraftChannel('HASHTAG', 'mesh', 'uk-wide'))).toBe('#mesh · uk-wide');
    expect(formatMcChannelDraftLabel(newDraftChannel('PUBLIC', 'Scotland'))).toBe('Scotland');
  });

  it('includes type label in row display for catalog and draft', () => {
    expect(messageChannelRowDisplay(catalog[1])).toEqual({
      label: '#test · sample-west',
      typeLabel: 'HASHTAG',
    });
    expect(
      assignedMcChannelRowDisplay({ clientId: 'd', draft: newDraftChannel('PUBLIC', 'Scotland') }, catalog, [])
    ).toEqual({ label: 'Scotland', typeLabel: 'PUBLIC' });
  });

  it('formats hashtag labels when catalog mc_channel_type is API integer', () => {
    const intCatalog: MessageChannel[] = [
      {
        id: 11,
        name: 'test',
        constellation: 1,
        protocol: 'meshcore',
        mc_channel_type: 2,
        region_scope: 'uk-wide',
      },
    ];
    expect(
      formatAssignedMcChannelLabel({ clientId: 'a', catalogId: 11 }, intCatalog, feederSnapshots)
    ).toBe('#test · uk-wide');
  });

  it('maps assigned order to apply entries with slot indices', () => {
    const assigned = [
      { clientId: 'd1', draft: newDraftChannel('HASHTAG', 'newtag', 'west') },
      { clientId: 'c1', catalogId: 10 },
    ];
    expect(assignedToApplyEntries(assigned, catalog, feederSnapshots)).toEqual([
      {
        mc_channel_idx: 0,
        mc_channel_type: 'HASHTAG',
        name: 'newtag',
        region_scope: 'west',
      },
      {
        mc_channel_idx: 1,
        mc_channel_type: 'PUBLIC',
        name: 'Scotland',
        region_scope: null,
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
