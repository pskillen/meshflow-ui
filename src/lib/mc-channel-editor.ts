import type { McChannelApplyEntry, McChannelSnapshot, MessageChannel, OwnedManagedNode } from '@/lib/models';
import {
  formatMcHashtagLabel,
  formatMessageChannelLabel,
  isMcHashtagChannelType,
  normalizeMcChannelTypeLabel,
  type McChannelTypeLabel,
} from '@/lib/message-channels';
import { formatRegionScopeSuffix, normalizeRegionScope } from '@/lib/mc-region-scope';

export type McChannelDraft = {
  mc_channel_type: 'PUBLIC' | 'HASHTAG';
  name: string;
  region_scope: string | null;
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

export function isHashtagType(type: string | number | null | undefined): boolean {
  return isMcHashtagChannelType(type);
}

export function formatMcChannelDraftLabel(draft: McChannelDraft): string {
  const scope = formatRegionScopeSuffix(draft.region_scope);
  if (isHashtagType(draft.mc_channel_type)) {
    const tag = stripHashtagPrefix(draft.name);
    return tag ? `${formatMcHashtagLabel(tag)}${scope}` : `Hashtag channel${scope}`;
  }
  return `${(draft.name || 'Public channel').trim()}${scope}`;
}

export type McChannelRowDisplay = {
  label: string;
  typeLabel: McChannelTypeLabel | null;
};

export function messageChannelRowDisplay(ch: MessageChannel): McChannelRowDisplay {
  return {
    label: formatMessageChannelLabel(ch),
    typeLabel: normalizeMcChannelTypeLabel(ch.mc_channel_type),
  };
}

export function assignedMcChannelRowDisplay(
  assigned: AssignedMcChannel,
  catalog: MessageChannel[],
  feederSnapshots: McChannelSnapshot[]
): McChannelRowDisplay {
  if (assigned.catalogId != null) {
    const fromCatalog = catalog.find((c) => c.id === assigned.catalogId);
    if (fromCatalog) {
      return messageChannelRowDisplay(fromCatalog);
    }
    const fromFeeder = feederSnapshots.find((c) => c.id === assigned.catalogId);
    if (fromFeeder) {
      return {
        label: snapshotToLabel(fromFeeder),
        typeLabel: normalizeMcChannelTypeLabel(fromFeeder.mc_channel_type),
      };
    }
  }
  if (assigned.draft) {
    return {
      label: formatMcChannelDraftLabel(assigned.draft),
      typeLabel: assigned.draft.mc_channel_type,
    };
  }
  return { label: 'Channel', typeLabel: null };
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
  const scope = formatRegionScopeSuffix(ch.region_scope);
  if (isHashtagType(ch.mc_channel_type)) {
    const tag = stripHashtagPrefix(ch.name);
    return tag ? `${formatMcHashtagLabel(tag)}${scope}` : ch.name;
  }
  return `${ch.name}${scope}`;
}

export function messageChannelToDraft(ch: MessageChannel): McChannelDraft {
  const isHashtag = isHashtagType(ch.mc_channel_type ?? undefined);
  if (isHashtag) {
    const tag = stripHashtagPrefix(ch.name);
    return {
      mc_channel_type: 'HASHTAG',
      name: tag,
      region_scope: ch.region_scope ?? null,
    };
  }
  return {
    mc_channel_type: 'PUBLIC',
    name: (ch.name || 'Public').trim(),
    region_scope: ch.region_scope ?? null,
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
    region_scope: draft.region_scope,
  };
}

function applyEntryFromSnapshot(ch: McChannelSnapshot, index: number): McChannelApplyEntry {
  if (isHashtagType(ch.mc_channel_type)) {
    const tag = stripHashtagPrefix(ch.name);
    return {
      mc_channel_idx: index,
      mc_channel_type: 'HASHTAG',
      name: tag,
      region_scope: ch.region_scope ?? null,
    };
  }
  return {
    mc_channel_idx: index,
    mc_channel_type: 'PUBLIC',
    name: (ch.name || 'Public').trim(),
    region_scope: ch.region_scope ?? null,
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
        const tag = stripHashtagPrefix(row.draft.name);
        return {
          mc_channel_idx: index,
          mc_channel_type: 'HASHTAG',
          name: tag,
          region_scope: row.draft.region_scope,
        };
      }
      return {
        mc_channel_idx: index,
        mc_channel_type: 'PUBLIC',
        name: row.draft.name.trim() || 'Public',
        region_scope: row.draft.region_scope,
      };
    }
    throw new Error('Invalid assigned channel row');
  });
}

export function newDraftChannel(
  type: 'PUBLIC' | 'HASHTAG',
  nameInput: string,
  regionScopeInput?: string
): McChannelDraft {
  const region_scope = normalizeRegionScope(regionScopeInput ?? null);
  if (type === 'HASHTAG') {
    const tag = stripHashtagPrefix(nameInput);
    return { mc_channel_type: 'HASHTAG', name: tag, region_scope };
  }
  return {
    mc_channel_type: 'PUBLIC',
    name: nameInput.trim() || 'Public',
    region_scope,
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
