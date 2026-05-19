import type { HeatmapEdge, HeatmapNode } from '@/hooks/api/useHeatmapEdges';

export function getHeatmapNodeLabel(node: HeatmapNode): string {
  return node.short_name || node.long_name || node.node_id_str || `!${node.meshtastic_node_id.toString(16)}`;
}

/** Fallback fill when API omits centrality/degree */
export const HEATMAP_NODE_COLOR_FALLBACK: [number, number, number, number] = [134, 239, 172, 200];

export const PACKETS_QUIET_COLOR: [number, number, number, number] = [59, 130, 246, 200];
export const PACKETS_BUSY_COLOR: [number, number, number, number] = [249, 115, 22, 200];
export const SNR_BAD_COLOR: [number, number, number, number] = [239, 68, 68, 200];
export const SNR_GOOD_COLOR: [number, number, number, number] = [34, 197, 94, 200];

export function interpolatePacketsColor(weight: number, minW: number, maxW: number): [number, number, number, number] {
  if (maxW <= minW) return PACKETS_QUIET_COLOR;
  const t = (weight - minW) / (maxW - minW);
  const r = Math.round(PACKETS_QUIET_COLOR[0] + (PACKETS_BUSY_COLOR[0] - PACKETS_QUIET_COLOR[0]) * t);
  const g = Math.round(PACKETS_QUIET_COLOR[1] + (PACKETS_BUSY_COLOR[1] - PACKETS_QUIET_COLOR[1]) * t);
  const b = Math.round(PACKETS_QUIET_COLOR[2] + (PACKETS_BUSY_COLOR[2] - PACKETS_QUIET_COLOR[2]) * t);
  return [r, g, b, 200];
}

export function interpolateSnrColor(snr: number, minS: number, maxS: number): [number, number, number, number] {
  if (maxS <= minS) return SNR_GOOD_COLOR;
  const t = (snr - minS) / (maxS - minS);
  const r = Math.round(SNR_BAD_COLOR[0] + (SNR_GOOD_COLOR[0] - SNR_BAD_COLOR[0]) * t);
  const g = Math.round(SNR_BAD_COLOR[1] + (SNR_GOOD_COLOR[1] - SNR_BAD_COLOR[1]) * t);
  const b = Math.round(SNR_BAD_COLOR[2] + (SNR_GOOD_COLOR[2] - SNR_BAD_COLOR[2]) * t);
  return [r, g, b, 200];
}

export function numericExtent(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max <= min) return { min, max: min + 1e-9 };
  return { min, max };
}

export function staleThresholdMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

export function isVisuallyStale(node: HeatmapNode, nowMs: number, staleMs: number): boolean {
  if (node.role === 'offline') return true;
  if (!node.last_seen) return true;
  const t = Date.parse(node.last_seen);
  if (Number.isNaN(t)) return true;
  return nowMs - t > staleMs;
}

export function recencyAlpha(node: HeatmapNode, nowMs: number, staleMs: number): number {
  if (!node.last_seen) return 95;
  const t = Date.parse(node.last_seen);
  if (Number.isNaN(t)) return 95;
  const age = nowMs - t;
  if (age >= staleMs) return 88;
  const u = age / staleMs;
  return Math.round(255 - u * (255 - 155));
}

export function degreeFillColor(
  node: HeatmapNode,
  degMin: number,
  degMax: number,
  nowMs: number,
  staleMs: number
): [number, number, number, number] {
  const grey: [number, number, number] = [148, 163, 184];
  if (isVisuallyStale(node, nowMs, staleMs)) {
    return [...grey, 100];
  }
  const t = degMax > degMin ? ((node.degree ?? 0) - degMin) / (degMax - degMin) : 0.5;
  const r = Math.round(59 + (249 - 59) * t);
  const g = Math.round(130 + (115 - 130) * t);
  const b = Math.round(246 + (22 - 246) * t);
  const alpha = recencyAlpha(node, nowMs, staleMs);
  return [r, g, b, alpha];
}

/** Deck.gl scatter radius in meters (matches prior TracerouteHeatmapMap behaviour). */
export function nodeRadiusMeters(centrality: number | undefined, cMin: number, cMax: number): number {
  if (centrality == null) return 380;
  if (cMax <= cMin) return 380;
  const u = (centrality - cMin) / (cMax - cMin);
  return 140 + u * 760;
}

/** Pixel radius for canvas/SVG topology (mirrors deck min/max pixel intent ~4–22). */
export function nodeRadiusPixels(centrality: number | undefined, cMin: number, cMax: number): number {
  if (centrality == null) return 11;
  if (cMax <= cMin) return 11;
  const u = (centrality - cMin) / (cMax - cMin);
  return 4 + u * 18;
}

export function nodeLineWidth(node: HeatmapNode, degMin: number, degMax: number): number {
  const t = degMax > degMin ? ((node.degree ?? 0) - degMin) / (degMax - degMin) : 0;
  let w = 1 + t * 6;
  if (node.role === 'backbone') w += 2.5;
  if (node.role === 'offline') w = Math.min(w, 1);
  return w;
}

export function nodeLineColor(fill: [number, number, number, number]): [number, number, number, number] {
  const [r, g, b, a] = fill;
  return [Math.round(r * 0.35), Math.round(g * 0.38), Math.round(b * 0.42), Math.min(255, a + 35)];
}

export interface HeatmapNodeExtents {
  cExt: { min: number; max: number };
  dExt: { min: number; max: number };
  hasSignal: boolean;
}

export function computeHeatmapNodeExtents(nodes: HeatmapNode[]): HeatmapNodeExtents {
  const hasSignal = nodes.some((n) => n.centrality != null && n.degree != null);
  const centralities = nodes.map((n) => n.centrality).filter((c): c is number => c != null && !Number.isNaN(c));
  const degrees = nodes.map((n) => n.degree).filter((d): d is number => d != null && !Number.isNaN(d));
  const cExt = numericExtent(centralities.length ? centralities : [0, 1]);
  const dExt = numericExtent(degrees.length ? degrees : [0, 1]);
  return { cExt, dExt, hasSignal };
}

export interface HeatmapArcEncoding {
  minVal: number;
  maxVal: number;
  valueKey: 'avg_snr' | 'weight';
  useSnrColors: boolean;
  baseWidth: number;
}

export function computeHeatmapArcEncoding(
  edges: HeatmapEdge[],
  edgeMetric: 'packets' | 'snr',
  intensity: number
): HeatmapArcEncoding | null {
  if (edges.length === 0) return null;
  const preferSnr = edgeMetric === 'snr';
  const snrValues = edges.map((e) => e.avg_snr ?? -999).filter((v) => v > -999);
  const hasSnrData = snrValues.length > 0;
  const useSnrColors = preferSnr;
  const values = hasSnrData ? snrValues : edges.map((e) => e.weight);
  const valueKey = hasSnrData ? 'avg_snr' : 'weight';
  if (values.length === 0) return null;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const baseWidth = 1 + intensity * 4;
  return { minVal, maxVal, valueKey, useSnrColors, baseWidth };
}

export function edgeArcColor(edge: HeatmapEdge, enc: HeatmapArcEncoding): [number, number, number, number] {
  const v = enc.valueKey === 'avg_snr' ? (edge.avg_snr ?? enc.minVal) : edge.weight;
  return enc.useSnrColors
    ? interpolateSnrColor(v, enc.minVal, enc.maxVal)
    : interpolatePacketsColor(v, enc.minVal, enc.maxVal);
}

export function edgeArcWidth(edge: HeatmapEdge, enc: HeatmapArcEncoding): number {
  const v = enc.valueKey === 'avg_snr' ? (edge.avg_snr ?? enc.minVal) : edge.weight;
  return enc.baseWidth * (0.5 + (v - enc.minVal) / Math.max(enc.maxVal - enc.minVal, 0.001));
}
