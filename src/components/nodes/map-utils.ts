import L from 'leaflet';
import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';

/** Role IDs from Meshtastic (matches ROLE_LABELS in lib/meshtastic). */
export const ROLE_COLORS: Record<number, string> = {
  2: '#2563eb', // ROUTER – blue
  3: '#16a34a', // ROUTER_CLIENT – green
  4: '#ea580c', // REPEATER – orange
  11: '#9333ea', // ROUTER_LATE – purple
  12: '#0d9488', // CLIENT_BASE – teal
};
const DEFAULT_ROLE_COLOR = '#64748b'; // Unknown / no role – slate

export function getRoleColor(role: number | null | undefined): string {
  return role != null && ROLE_COLORS[role] ? ROLE_COLORS[role] : DEFAULT_ROLE_COLOR;
}

/** Fresh weather marker fill (sky). Fades toward stale slate over `fadeHours`. */
export const WEATHER_MARKER_FRESH_HEX = '#0ea5e9';
export const WEATHER_MARKER_STALE_HEX = '#94a3b8';

const WEATHER_MARKER_FRESH_RGB = { r: 14, g: 165, b: 233 }; // sync with WEATHER_MARKER_FRESH_HEX
const WEATHER_MARKER_STALE_RGB = { r: 148, g: 163, b: 184 }; // sync with WEATHER_MARKER_STALE_HEX

/** Pill colour when env time is missing (should not appear on map for long). */
export const WEATHER_MARKER_STALE_COLOR = `rgb(${WEATHER_MARKER_STALE_RGB.r},${WEATHER_MARKER_STALE_RGB.g},${WEATHER_MARKER_STALE_RGB.b})`;

/** Cold and hot endpoints for the temperature gradient on the weather map. */
export const WEATHER_TEMP_COLD_HEX = '#2563eb'; // cold blue
export const WEATHER_TEMP_HOT_HEX = '#dc2626'; // hot red

const WEATHER_TEMP_COLD_RGB = { r: 37, g: 99, b: 235 }; // sync with WEATHER_TEMP_COLD_HEX
const WEATHER_TEMP_HOT_RGB = { r: 220, g: 38, b: 38 }; // sync with WEATHER_TEMP_HOT_HEX

/** Neutral fill used when temperature is missing or the visible range is degenerate. */
export const WEATHER_TEMP_NEUTRAL_COLOR = WEATHER_MARKER_STALE_COLOR;

/**
 * Background color for a weather map pill by env reading age: full sky blue when fresh, slate gray at `fadeHours`.
 */
export function weatherMarkerBackgroundColor(
  reportedTime: Date,
  fadeHours: number,
  nowMs: number = Date.now()
): string {
  const ageMs = Math.max(0, nowMs - reportedTime.getTime());
  const t = Math.min(1, ageMs / (fadeHours * 60 * 60 * 1000));
  const a = WEATHER_MARKER_FRESH_RGB;
  const b = WEATHER_MARKER_STALE_RGB;
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Map a temperature in Celsius to a colour on the cold-blue → hot-red gradient.
 * Returns a neutral fill when temperature is missing or the [min, max] range is degenerate.
 */
export function temperatureColor(
  tempC: number | null | undefined,
  minC: number | null | undefined,
  maxC: number | null | undefined
): string {
  if (tempC == null || !Number.isFinite(tempC)) return WEATHER_TEMP_NEUTRAL_COLOR;
  if (minC == null || maxC == null || !Number.isFinite(minC) || !Number.isFinite(maxC)) {
    return WEATHER_TEMP_NEUTRAL_COLOR;
  }
  if (maxC - minC < 0.001) return WEATHER_TEMP_NEUTRAL_COLOR;
  const t = Math.max(0, Math.min(1, (tempC - minC) / (maxC - minC)));
  const a = WEATHER_TEMP_COLD_RGB;
  const b = WEATHER_TEMP_HOT_RGB;
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Border colour for a weather marker indicating env reading age:
 * fully transparent at fresh, fading to opaque slate over `fadeHours`.
 */
export function weatherBorderColor(
  reportedTime: Date | null | undefined,
  fadeHours: number,
  nowMs: number = Date.now()
): string {
  if (!reportedTime) {
    const s = WEATHER_MARKER_STALE_RGB;
    return `rgba(${s.r},${s.g},${s.b},1)`;
  }
  const ageMs = Math.max(0, nowMs - reportedTime.getTime());
  const t = Math.min(1, ageMs / (fadeHours * 60 * 60 * 1000));
  const s = WEATHER_MARKER_STALE_RGB;
  return `rgba(${s.r},${s.g},${s.b},${t.toFixed(3)})`;
}

export interface WeatherTemperatureAnchors {
  /** 5th-percentile temperature across the input set (°C); null if undefined. */
  minC: number | null;
  /** 95th-percentile temperature across the input set (°C); null if undefined. */
  maxC: number | null;
}

/**
 * Compute robust temperature anchors (5th / 95th percentile) from a list of Celsius readings.
 * Filters non-finite values. Returns nulls when fewer than 2 valid readings.
 *
 * >>> computeWeatherTemperatureAnchors([])
 * { minC: null, maxC: null }
 */
export function computeWeatherTemperatureAnchors(
  temperaturesC: Array<number | null | undefined>
): WeatherTemperatureAnchors {
  const values = temperaturesC.filter((t): t is number => t != null && Number.isFinite(t));
  if (values.length === 0) return { minC: null, maxC: null };
  if (values.length === 1) return { minC: values[0], maxC: values[0] };
  const sorted = [...values].sort((a, b) => a - b);
  return { minC: percentileSorted(sorted, 5), maxC: percentileSorted(sorted, 95) };
}

function percentileSorted(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Minimal node fields for popup content */
export interface NodePopupData {
  meshtastic_node_id: number;
  node_id_str?: string;
  long_name: string | null;
  short_name: string | null;
  /** Date or ISO string – API may return either; we normalize to locale format */
  last_heard?: Date | string | null;
  /** Constellation name when this is a managed node */
  constellationName?: string | null;
}

/**
 * Build HTML for a map marker popup.
 * Format: **Long name (short name)** / Last seen: ... / [Constellation: ...] / Open details link
 */
export function buildNodePopupHtml(node: NodePopupData): string {
  const displayName =
    node.long_name && node.short_name
      ? `${node.long_name} (${node.short_name})`
      : node.long_name || node.short_name || node.node_id_str || `Node ${node.meshtastic_node_id}`;
  const lastSeen = node.last_heard != null ? new Date(node.last_heard).toLocaleString() : 'Never';
  const detailsUrl = `/nodes/${node.meshtastic_node_id}`;
  const constellationLine =
    node.constellationName != null && node.constellationName !== ''
      ? `Constellation: ${escapeHtml(node.constellationName)}`
      : null;
  return `
  <strong>${escapeHtml(displayName)}</strong><br>
  Last seen: ${escapeHtml(lastSeen)}<br>
  ${constellationLine ? `<span style="color: #666;">${constellationLine}</span><br>` : ''}
  <a href="${detailsUrl}">Open details</a>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeHtmlForMarker(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Create a custom marker icon with bottom-centre anchor.
 * The teardrop tip aligns with the map point.
 * @param dimmed - When true, applies opacity 0.5 (for unselected nodes when one is selected)
 * @param opacity - Optional 0-1 opacity override
 * @param grayscale - Optional 0-1 grayscale (CSS filter, 0=full color, 1=100% gray)
 */
export function createNodeIcon(
  text: string,
  color: string,
  highlighted = false,
  dimmed = false,
  opacity?: number,
  grayscale?: number,
  /** Optional outer frame for ops alerts (Mesh Infra); keeps pin fill `color`. */
  alertRing?: 'diamond' | 'rounded-square'
): L.DivIcon {
  const highlightClass = highlighted ? ' marker-pin-highlighted' : '';
  const styles: string[] = [];
  if (opacity != null) styles.push(`opacity: ${opacity}`);
  else if (dimmed) styles.push('opacity: 0.5');
  if (grayscale != null && grayscale > 0) styles.push(`filter: grayscale(${grayscale * 100}%)`);
  const containerStyle = styles.length > 0 ? styles.join('; ') + ';' : '';
  const ringColor = 'rgba(234, 88, 12, 0.95)';
  const diamondRing =
    alertRing === 'diamond'
      ? `<div style="position:absolute;left:50%;top:50%;width:42px;height:42px;margin:-21px 0 0 -21px;border:3px solid ${ringColor};border-radius:5px;transform:rotate(45deg);pointer-events:none;z-index:0;"></div>`
      : '';
  const roundedRing =
    alertRing === 'rounded-square'
      ? `<div style="position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:3px solid ${ringColor};border-radius:12px;pointer-events:none;z-index:0;"></div>`
      : '';
  const stackOpen =
    alertRing != null
      ? `<div class="marker-stack" style="position:relative;width:52px;height:52px;margin:-6px 0 0 -6px;">${diamondRing}${roundedRing}`
      : '';
  const stackClose = alertRing != null ? '</div>' : '';
  const innerWrap = alertRing != null ? `<div style="position:relative;z-index:1;">` : '';
  const innerClose = alertRing != null ? '</div>' : '';
  const iconSize: [number, number] = alertRing != null ? [52, 52] : [40, 40];
  const iconAnchor: [number, number] = alertRing != null ? [26, 46] : [20, 40];
  const popupY = alertRing != null ? -46 : -40;
  return L.divIcon({
    className: 'custom-node-marker',
    html: `
      ${stackOpen}
      ${innerWrap}
      <div class="marker-container" style="${containerStyle}">
        <div class="marker-pin${highlightClass}" style="background: ${color};"></div>
        <span class="marker-text">${text}</span>
      </div>
      ${innerClose}
      ${stackClose}
    `,
    iconSize,
    iconAnchor,
    popupAnchor: [0, popupY],
  });
}

const WEATHER_MARKER_WIDTH = 130;
const WEATHER_MARKER_HEIGHT = 56;

/**
 * Create a larger rounded-rectangle marker for weather nodes.
 * Better readability for multi-line labels (temp | pressure | RH).
 * @param text - Label content (e.g. "9.5°C | 955 hPa | 68%")
 * @param color - Background color
 * @param highlighted - When true, adds highlight ring
 * @param dimmed - When true, applies opacity 0.5
 * @param opacity - Optional 0-1 opacity override
 * @param grayscale - Optional 0-1 grayscale (0=full color, 1=100% gray)
 * @param borderColor - Optional CSS colour for a 3px inset border (e.g. age indicator)
 */
export function createWeatherNodeIcon(
  text: string,
  color: string,
  highlighted = false,
  dimmed = false,
  opacity?: number,
  grayscale?: number,
  borderColor?: string
): L.DivIcon {
  const styles: string[] = [];
  if (opacity != null) styles.push(`opacity: ${opacity}`);
  else if (dimmed) styles.push('opacity: 0.5');
  if (grayscale != null && grayscale > 0) styles.push(`filter: grayscale(${grayscale * 100}%)`);
  const containerStyle = styles.length > 0 ? styles.join('; ') + ';' : '';
  const shadowParts: string[] = [];
  if (borderColor) shadowParts.push(`inset 0 0 0 5px ${borderColor}`);
  if (highlighted) shadowParts.push('0 0 0 3px rgba(226, 153, 6, 0.9)');
  const shadowStyle = shadowParts.length > 0 ? `box-shadow: ${shadowParts.join(', ')};` : '';
  return L.divIcon({
    className: 'custom-node-marker weather-node-marker',
    html: `
      <div class="weather-marker-container" style="${containerStyle}">
        <div class="weather-marker-pill" style="background: ${color}; ${shadowStyle}">
          <span class="weather-marker-text">${escapeHtmlForMarker(text)}</span>
        </div>
      </div>
    `,
    iconSize: [WEATHER_MARKER_WIDTH, WEATHER_MARKER_HEIGHT],
    iconAnchor: [WEATHER_MARKER_WIDTH / 2, WEATHER_MARKER_HEIGHT],
    popupAnchor: [0, -WEATHER_MARKER_HEIGHT],
  });
}

/**
 * Meshtastic meshtastic_precision_bits to approximate radius in meters.
 * Lower meshtastic_precision_bits = larger uncertainty (more obfuscation).
 * Source: https://meshtastic.org/docs/configuration/radio/channels/#position-precision
 *
 * Values 0–32: 0 = never send, 32 = full precision.
 * Documented range 10–19; 20–31 extrapolated (each bit halves uncertainty).
 */
export function precisionBitsToMeters(precisionBits: number | null | undefined): number | null {
  if (precisionBits == null) return null;
  if (precisionBits === 0) return null; // Location never sent
  if (precisionBits >= 32) return null; // Full precision, no uncertainty to draw

  // From Meshtastic docs: https://meshtastic.org/docs/configuration/radio/channels/
  // Bits 1–9 extrapolated (each bit halves uncertainty); 10–19 from official table
  const lookup: Record<number, number> = {
    1: 11930e3, // ~23.3 * 2^9 km
    2: 5965e3,
    3: 2982e3,
    4: 1491e3,
    5: 746e3,
    6: 373e3,
    7: 186e3,
    8: 93.2e3,
    9: 46.6e3,
    10: 23.3e3, // 23.3 km
    11: 11.7e3, // 11.7 km
    12: 5.8e3, // 5.8 km
    13: 2.9e3, // 2.9 km
    14: 1.5e3, // 1.5 km
    15: 729, // 729 m
    16: 364, // 364 m
    17: 182, // 182 m
    18: 91, // 91 m
    19: 45, // 45 m
    20: 22.5,
    21: 11.25,
    22: 5.6,
    23: 2.8,
    24: 1.4,
    25: 0.7,
    26: 0.35,
    27: 0.18,
    28: 0.09,
    29: 0.045,
    30: 0.02,
    31: 0.01,
  };
  const meters = lookup[precisionBits];
  return meters ?? (precisionBits <= 19 ? 45 : 0.01);
}

/**
 * Build a boundary polygon from points using a buffered concave hull.
 *
 * Mesh coverage in non-isotropic terrain (hills, lochs, the central belt) is not
 * well represented by a convex hull, so we use turf.concave with a generous edge
 * length to "cling" around outliers. We fall back to convex when concave fails
 * (e.g. all points colinear, fewer than 3 points, or no triangulation possible).
 */
const CONCAVE_MAX_EDGE_KM = 2;

export function boundaryPolygonFromPoints(
  points: Feature<Point>[],
  radiusKm: number
): Feature<Polygon> | Feature<MultiPolygon> | null {
  if (points.length === 0) return null;

  const bufferOpts = { units: 'kilometers' as const };

  if (points.length === 1) {
    return turf.buffer(points[0], radiusKm, bufferOpts) as Feature<Polygon>;
  }

  const fc = turf.featureCollection(points);

  if (points.length >= 3) {
    try {
      const concave = turf.concave(fc, {
        maxEdge: CONCAVE_MAX_EDGE_KM,
        units: 'kilometers',
      }) as Feature<Polygon | MultiPolygon> | null;
      if (concave?.geometry) {
        return turf.buffer(concave, radiusKm, bufferOpts) as Feature<Polygon> | Feature<MultiPolygon>;
      }
    } catch {
      // turf.concave can throw on degenerate inputs; fall through to convex.
    }
  }

  const hull = turf.convex(fc) as Feature<Polygon> | undefined;
  if (!hull?.geometry || hull.geometry.type !== 'Polygon') {
    return turf.buffer(points[0], radiusKm, bufferOpts) as Feature<Polygon>;
  }
  return turf.buffer(hull, radiusKm, bufferOpts) as Feature<Polygon>;
}
