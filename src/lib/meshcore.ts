/**
 * MeshCore ADVERT adv_type values (MeshCore payload docs).
 * 0 = none, 1 = chat, 2 = repeater, 3 = room, 4 = sensor.
 */
export const MESHCORE_ADV_TYPE_LABELS: Record<number, string> = {
  1: 'Chat',
  2: 'Repeater',
  3: 'Room server',
  4: 'Sensor',
};

export const MESHCORE_ADV_TYPE_COLORS: Record<number, string> = {
  1: '#7c3aed', // chat – violet
  2: '#ea580c', // repeater – orange
  3: '#0891b2', // room – cyan
  4: '#65a30d', // sensor – lime
};

const DEFAULT_ADV_TYPE_COLOR = '#64748b';

export function getMeshCoreAdvTypeLabel(advType: number | null | undefined): string | null {
  if (advType == null) return null;
  return MESHCORE_ADV_TYPE_LABELS[advType] ?? `Type ${advType}`;
}

export function getMeshCoreAdvTypeColor(advType: number | null | undefined): string {
  if (advType == null) return DEFAULT_ADV_TYPE_COLOR;
  return MESHCORE_ADV_TYPE_COLORS[advType] ?? DEFAULT_ADV_TYPE_COLOR;
}
