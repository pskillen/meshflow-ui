import { IconLayer } from '@deck.gl/layers';

import type { FeederReachFeeder } from '@/lib/api/meshflow-api';

/** Broadcast tower on slate disc — visually distinct from reliability dots. */
const FEEDER_TOWER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
  <defs>
    <filter id="fs" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <circle cx="36" cy="38" r="24" fill="#0f172a" stroke="#f8fafc" stroke-width="2.5" filter="url(#fs)"/>
  <rect x="33" y="14" width="6" height="22" fill="#fb923c" stroke="#fff7ed" stroke-width="1"/>
  <path d="M22 30 L50 30 L46 16 L26 16 Z" fill="#fb923c" stroke="#fff7ed" stroke-width="1"/>
  <line x1="18" y1="16" x2="54" y2="16" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
  <line x1="26" y1="10" x2="46" y2="10" stroke="#f8fafc" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const FEEDER_TOWER_ICON_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FEEDER_TOWER_ICON_SVG)}`;

const FEEDER_ICON_DESCRIPTOR = {
  url: FEEDER_TOWER_ICON_URL,
  width: 72,
  height: 72,
  anchorY: 72,
} as const;

export type FeederIconDatum = Pick<
  FeederReachFeeder,
  'lat' | 'lng' | 'meshtastic_node_id' | 'node_id_str' | 'short_name' | 'long_name' | 'managed_node_id'
> & { lat: number; lng: number };

export function buildFeederIconLayer<T extends FeederIconDatum>(
  data: T[],
  options?: { id?: string; size?: number; pickable?: boolean }
): IconLayer<T> {
  return new IconLayer<T>({
    id: options?.id ?? 'feeder-tower-icons',
    data,
    pickable: options?.pickable ?? true,
    getPosition: (d) => [d.lng, d.lat],
    getIcon: () => FEEDER_ICON_DESCRIPTOR,
    getSize: options?.size ?? 36,
    sizeUnits: 'pixels',
  });
}
