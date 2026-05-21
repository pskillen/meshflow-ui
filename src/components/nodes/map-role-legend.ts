import { ROLE_COLORS } from './map-utils';
import { ROLE_LABELS } from '@/lib/meshtastic';
import { MESHCORE_ADV_TYPE_COLORS, MESHCORE_ADV_TYPE_LABELS } from '@/lib/meshcore';

const UNKNOWN_COLOR = '#64748b';

export type RoleLegendSwatch = { key: string; label: string; color: string };

/** Swatches matching `getRoleColor` / map marker role semantics. */
export function meshRoleLegendSwatches(): RoleLegendSwatch[] {
  const sw: RoleLegendSwatch[] = (Object.keys(ROLE_COLORS) as string[]).map((k) => {
    const id = Number(k);
    return {
      key: `role-${id}`,
      label: ROLE_LABELS[id] ?? `Role ${id}`,
      color: ROLE_COLORS[id as keyof typeof ROLE_COLORS],
    };
  });
  sw.push({ key: 'role-unknown', label: 'Unknown / other', color: UNKNOWN_COLOR });
  return sw;
}

/** MeshCore ADVERT adv_type legend (Chat, Repeater, Room, Sensor). */
export function meshcoreRoleLegendSwatches(): RoleLegendSwatch[] {
  const sw: RoleLegendSwatch[] = (Object.keys(MESHCORE_ADV_TYPE_COLORS) as string[]).map((k) => {
    const id = Number(k);
    return {
      key: `mc-adv-${id}`,
      label: MESHCORE_ADV_TYPE_LABELS[id] ?? `Type ${id}`,
      color: MESHCORE_ADV_TYPE_COLORS[id],
    };
  });
  sw.push({ key: 'mc-adv-unknown', label: 'Unknown / no type', color: UNKNOWN_COLOR });
  return sw;
}

export function roleLegendSwatchesForProtocol(roleLegend: 'meshtastic' | 'meshcore'): RoleLegendSwatch[] {
  return roleLegend === 'meshcore' ? meshcoreRoleLegendSwatches() : meshRoleLegendSwatches();
}
