import type { McChannelApplyEntry, McChannelSnapshot, MessageChannel, OwnedManagedNode } from '@/lib/models';
import { formatMessageChannelLabel } from '@/lib/message-channels';

export type McChannelDraft = {
  mc_channel_type: 'PUBLIC' | 'HASHTAG';
  name: string;
  mc_hashtag: string | null;
};

/** Channel assigned to a feeder slot (order = device index). */
export type AssignedMcChannel = {
  clientId: string;
  catalogId?: number;
  draft?: McChannelDraft;
};

export function stripHashtagPrefix(value: string): string {
  return value.replace(/^#+/, '').trim();
}

export function isHashtagType(type: string | undefined): boolean {
  return String(type ?? '').toUpperCase() === 'HASHTAG';
}

export function formatMcChannelDraftLabel(draft: McChannelDraft): string {
  if (isHashtagType(draft.mc_channel_type)) {
    const tag = stripHashtagPrefix(draft.mc_hashtag ?? draft.name);
    return tag ? `#${tag}` : 'Hashtag channel';
  }
  return (draft.name || 'Public channel').trim();
}

export function formatAssignedMcChannelLabel(
  assigned: AssignedMcChannel,
  catalog: MessageChannel[],
  feederSnapshots: McChannelSnapshot[]
): string {
  if (assigned.catalogId != null) {
    const fromCatalog = catalog.find((c) => c.id === assigned.catalogId);
    if (fromCatalog) {
      return formatMessageChannelLabel(fromCatalog);
    }
    const fromFeeder = feederSnapshots.find((c) => c.id === assigned.catalogId);
    if (fromFeeder) {
      return snapshotToLabel(fromFeeder);
    }
  }
  if (assigned.draft) {
    return formatMcChannelDraftLabel(assigned.draft);
  }
  return 'Channel';
}

function snapshotToLabel(ch: McChannelSnapshot): string {
  if (isHashtagType(ch.mc_channel_type)) {
    const tag = stripHashtagPrefix(ch.mc_hashtag ?? ch.name);
    return tag ? `#${tag}` : ch.name;
  }
  return ch.name;
}

export function messageChannelToDraft(ch: MessageChannel): McChannelDraft {
  const isHashtag = isHashtagType(ch.mc_channel_type ?? undefined);
  if (isHashtag) {
    const tag = stripHashtagPrefix(ch.mc_hashtag ?? ch.name);
    return {
      mc_channel_type: 'HASHTAG',
      name: tag,
      mc_hashtag: tag || null,
    };
  }
  return {
    mc_channel_type: 'PUBLIC',
    name: (ch.name || 'Public').trim(),
    mc_hashtag: null,
  };
}

export function assignedFromFeeder(node: OwnedManagedNode): AssignedMcChannel[] {
  return (node.mc_channels ?? []).map((ch) => ({
    clientId: `catalog-${ch.id}`,
    catalogId: ch.id,
  }));
}

export function assignedOrderKey(assigned: AssignedMcChannel[]): string {
  return assigned.map((a) => (a.catalogId != null ? `c:${a.catalogId}` : `d:${a.clientId}`)).join('|');
}

function applyEntryFromCatalog(ch: MessageChannel, index: number): McChannelApplyEntry {
  const draft = messageChannelToDraft(ch);
  return {
    mc_channel_idx: index,
    mc_channel_type: draft.mc_channel_type,
    name: draft.name,
    mc_hashtag: draft.mc_hashtag,
  };
}

function applyEntryFromSnapshot(ch: McChannelSnapshot, index: number): McChannelApplyEntry {
  if (isHashtagType(ch.mc_channel_type)) {
    const tag = stripHashtagPrefix(ch.mc_hashtag ?? ch.name);
    return {
      mc_channel_idx: index,
      mc_channel_type: 'HASHTAG',
      name: tag,
      mc_hashtag: tag || null,
    };
  }
  return {
    mc_channel_idx: index,
    mc_channel_type: 'PUBLIC',
    name: (ch.name || 'Public').trim(),
    mc_hashtag: null,
  };
}

export function assignedToApplyEntries(
  assigned: AssignedMcChannel[],
  catalog: MessageChannel[],
  feederSnapshots: McChannelSnapshot[]
): McChannelApplyEntry[] {
  return assigned.map((row, index) => {
    if (row.catalogId != null) {
      const fromCatalog = catalog.find((c) => c.id === row.catalogId);
      if (fromCatalog) {
        return applyEntryFromCatalog(fromCatalog, index);
      }
      const fromFeeder = feederSnapshots.find((c) => c.id === row.catalogId);
      if (fromFeeder) {
        return applyEntryFromSnapshot(fromFeeder, index);
      }
    }
    if (row.draft) {
      if (row.draft.mc_channel_type === 'HASHTAG') {
        const tag = stripHashtagPrefix(row.draft.mc_hashtag ?? row.draft.name);
        return {
          mc_channel_idx: index,
          mc_channel_type: 'HASHTAG',
          name: tag,
          mc_hashtag: tag || null,
        };
      }
      return {
        mc_channel_idx: index,
        mc_channel_type: 'PUBLIC',
        name: row.draft.name.trim() || 'Public',
        mc_hashtag: null,
      };
    }
    throw new Error('Invalid assigned channel row');
  });
}

export function newDraftChannel(type: 'PUBLIC' | 'HASHTAG', nameInput: string): McChannelDraft {
  if (type === 'HASHTAG') {
    const tag = stripHashtagPrefix(nameInput);
    return { mc_channel_type: 'HASHTAG', name: tag, mc_hashtag: tag || null };
  }
  return {
    mc_channel_type: 'PUBLIC',
    name: nameInput.trim() || 'Public',
    mc_hashtag: null,
  };
}

export function reorderAssigned(
  assigned: AssignedMcChannel[],
  fromIndex: number,
  toIndex: number
): AssignedMcChannel[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= assigned.length ||
    toIndex >= assigned.length
  ) {
    return assigned;
  }
  const next = [...assigned];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
