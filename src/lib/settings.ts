/**
 * Local storage keys and helpers for browser-only settings.
 */

export const STORAGE_KEYS = {
  MAP_TILE_SOURCE: 'meshflow-map-tile-source',
} as const;

export const DEFAULT_MAP_TILE_SOURCE = 'osm';

export type MapTileSourceId = 'auto' | 'osm' | 'positron' | 'dark-matter' | 'voyager' | 'satellite' | 'terrain';

const VALID_MAP_TILE_SOURCES: MapTileSourceId[] = [
  'auto',
  'osm',
  'positron',
  'dark-matter',
  'voyager',
  'satellite',
  'terrain',
];

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

export function getMapTileSource(): MapTileSourceId {
  if (!canUseLocalStorage()) return DEFAULT_MAP_TILE_SOURCE as MapTileSourceId;
  const stored = localStorage.getItem(STORAGE_KEYS.MAP_TILE_SOURCE);
  if (stored && VALID_MAP_TILE_SOURCES.includes(stored as MapTileSourceId)) {
    return stored as MapTileSourceId;
  }
  return DEFAULT_MAP_TILE_SOURCE as MapTileSourceId;
}

export function setMapTileSource(source: MapTileSourceId): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(STORAGE_KEYS.MAP_TILE_SOURCE, source);
  window.dispatchEvent(new Event('meshflow-settings-changed'));
}
