import { useCallback, useMemo, useState } from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { latLngToCell } from 'h3-js';
import { concave, featureCollection, point as turfPoint } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

import { buildFeederIconLayer } from '@/components/map/FeederIconLayer';
import {
  attemptsToRadius,
  LOW_CONFIDENCE_COLOR,
  reliabilityColor,
  smoothedRate,
} from '@/components/map/coverageStyling';
import { DeckMapboxMap } from '@/components/map/DeckMapboxMap';
import type { FeederReachFeeder, FeederReachTarget } from '@/lib/api/meshtastic-api';
import type { CoverageHeardGhost } from '@/lib/coverageHeardGhosts';

export type CoverageLayerKey = 'dots' | 'hex' | 'polygon' | 'heard';

const DEFAULT_CENTER = { longitude: -4.2518, latitude: 55.8642, zoom: 8 };
const POLYGON_FILL: [number, number, number, number] = [99, 102, 241, 50];
const POLYGON_STROKE: [number, number, number, number] = [99, 102, 241, 200];
const H3_RESOLUTION = 6;

function getTargetLabel(t: FeederReachTarget): string {
  return t.short_name || t.long_name || t.node_id_str || `!${t.node_id.toString(16)}`;
}

function feederPopupTitle(f: FeederReachFeeder): string {
  return f.short_name || f.long_name || f.node_id_str || `!${f.node_id.toString(16)}`;
}

interface HexBin {
  cell: string;
  attempts: number;
  successes: number;
  smoothed: number;
}

export interface FeederCoverageMapProps {
  feeder: FeederReachFeeder;
  targets: FeederReachTarget[];
  heardGhosts: CoverageHeardGhost[];
  enabledLayers: CoverageLayerKey[];
  minAttempts: number;
}

function ghostLabel(g: CoverageHeardGhost): string {
  return g.short_name || g.long_name || g.node_id_str || `!${g.node_id.toString(16)}`;
}

export function FeederCoverageMap({
  feeder,
  targets,
  heardGhosts,
  enabledLayers,
  minAttempts,
}: FeederCoverageMapProps) {
  const [selectedTarget, setSelectedTarget] = useState<FeederReachTarget | null>(null);
  const [selectedFeederMarker, setSelectedFeederMarker] = useState<FeederReachFeeder | null>(null);
  const [selectedHeardGhost, setSelectedHeardGhost] = useState<CoverageHeardGhost | null>(null);

  const enabledSet = useMemo(() => new Set(enabledLayers), [enabledLayers]);

  const dotsLayer = useMemo(() => {
    if (!enabledSet.has('dots') || targets.length === 0) return null;
    return new ScatterplotLayer({
      id: 'feeder-coverage-dots',
      data: targets,
      getPosition: (d) => [d.lng, d.lat],
      getFillColor: (d) =>
        d.attempts < minAttempts ? LOW_CONFIDENCE_COLOR : reliabilityColor(smoothedRate(d.successes, d.attempts)),
      getRadius: (d) => attemptsToRadius(d.attempts),
      radiusUnits: 'pixels',
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [15, 23, 42, 200],
      pickable: true,
    });
  }, [enabledSet, targets, minAttempts]);

  const hexBins: HexBin[] = useMemo(() => {
    const acc = new Map<string, { attempts: number; successes: number }>();
    for (const t of targets) {
      if (t.attempts < 1) continue;
      const cell = latLngToCell(t.lat, t.lng, H3_RESOLUTION);
      const existing = acc.get(cell);
      if (existing) {
        existing.attempts += t.attempts;
        existing.successes += t.successes;
      } else {
        acc.set(cell, { attempts: t.attempts, successes: t.successes });
      }
    }
    return Array.from(acc.entries()).map(([cell, agg]) => ({
      cell,
      attempts: agg.attempts,
      successes: agg.successes,
      smoothed: smoothedRate(agg.successes, agg.attempts),
    }));
  }, [targets]);

  const hexLayer = useMemo(() => {
    if (!enabledSet.has('hex') || hexBins.length === 0) return null;
    return new H3HexagonLayer({
      id: 'feeder-coverage-hex',
      data: hexBins,
      getHexagon: (d: HexBin) => d.cell,
      extruded: false,
      stroked: true,
      filled: true,
      getFillColor: (d: HexBin) =>
        d.attempts < minAttempts ? LOW_CONFIDENCE_COLOR : reliabilityColor(d.smoothed, 130),
      getLineColor: [15, 23, 42, 180],
      lineWidthMinPixels: 1,
      pickable: false,
    });
  }, [enabledSet, hexBins, minAttempts]);

  const polygonFeature = useMemo<Feature<Polygon | MultiPolygon> | null>(() => {
    if (!enabledSet.has('polygon')) return null;
    const successPoints = targets.filter((t) => t.successes > 0);
    if (successPoints.length < 3) return null;
    try {
      const fc = featureCollection(successPoints.map((t) => turfPoint([t.lng, t.lat])));
      const hull = concave(fc, { maxEdge: 2, units: 'kilometers' });
      return (hull as Feature<Polygon | MultiPolygon> | null) ?? null;
    } catch {
      return null;
    }
  }, [enabledSet, targets]);

  const polygonLayer = useMemo(() => {
    if (!polygonFeature) return null;
    const features = [polygonFeature];
    return new PolygonLayer({
      id: 'feeder-coverage-polygon',
      data: features,
      getPolygon: (f: Feature<Polygon | MultiPolygon>) => {
        if (f.geometry.type === 'Polygon') {
          return f.geometry.coordinates as number[][][];
        }
        return (f.geometry.coordinates as number[][][][]).flat() as unknown as number[][][];
      },
      getFillColor: POLYGON_FILL,
      getLineColor: POLYGON_STROKE,
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: false,
    });
  }, [polygonFeature]);

  const heardGhostsLayer = useMemo(() => {
    if (!enabledSet.has('heard') || heardGhosts.length === 0) return null;
    return new ScatterplotLayer<CoverageHeardGhost>({
      id: 'feeder-coverage-heard-ghosts',
      data: heardGhosts,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 4,
      radiusUnits: 'pixels',
      filled: false,
      stroked: true,
      lineWidthMinPixels: 1.5,
      getLineColor: [100, 116, 139, 220],
      pickable: true,
    });
  }, [enabledSet, heardGhosts]);

  const feederIconLayer = useMemo(() => {
    if (feeder.lat == null || feeder.lng == null) return null;
    return buildFeederIconLayer([{ ...feeder, lat: feeder.lat, lng: feeder.lng }], {
      id: 'feeder-coverage-feeder-icons',
      size: 36,
      pickable: true,
    });
  }, [feeder]);

  const layers = useMemo(
    () => [polygonLayer, hexLayer, heardGhostsLayer, dotsLayer, feederIconLayer].filter(Boolean) as Layer[],
    [polygonLayer, hexLayer, heardGhostsLayer, dotsLayer, feederIconLayer]
  );

  const handleClick = useCallback((info: PickingInfo) => {
    const lid = info.layer?.id;
    if (lid === 'feeder-coverage-feeder-icons' && info.object) {
      setSelectedFeederMarker(info.object as FeederReachFeeder);
      setSelectedTarget(null);
      setSelectedHeardGhost(null);
      return;
    }
    if (lid === 'feeder-coverage-dots' && info.object) {
      setSelectedTarget(info.object as FeederReachTarget);
      setSelectedFeederMarker(null);
      setSelectedHeardGhost(null);
      return;
    }
    if (lid === 'feeder-coverage-heard-ghosts' && info.object) {
      setSelectedHeardGhost(info.object as CoverageHeardGhost);
      setSelectedTarget(null);
      setSelectedFeederMarker(null);
      return;
    }
    setSelectedTarget(null);
    setSelectedFeederMarker(null);
    setSelectedHeardGhost(null);
  }, []);

  const initialView = useMemo(() => {
    if (feeder.lat != null && feeder.lng != null) {
      return { longitude: feeder.lng, latitude: feeder.lat, zoom: 9 };
    }
    return DEFAULT_CENTER;
  }, [feeder.lat, feeder.lng]);

  return (
    <DeckMapboxMap
      layers={layers}
      initialViewState={initialView}
      onClick={handleClick}
      data-testid="feeder-coverage-map-container"
    >
      {selectedTarget && (
        <Popup
          longitude={selectedTarget.lng}
          latitude={selectedTarget.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedTarget(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[180px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => setSelectedTarget(null)}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="pr-5">
              <div className="font-semibold">
                {selectedTarget.long_name && selectedTarget.short_name
                  ? `${selectedTarget.long_name} (${selectedTarget.short_name})`
                  : getTargetLabel(selectedTarget)}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {selectedTarget.node_id_str || `!${selectedTarget.node_id.toString(16)}`}
              </div>
              <div className="mt-1 text-xs">
                {selectedTarget.successes} / {selectedTarget.attempts} (
                {selectedTarget.attempts > 0
                  ? ((selectedTarget.successes / selectedTarget.attempts) * 100).toFixed(0)
                  : '0'}
                % raw)
              </div>
              <div className="text-xs">
                Smoothed: {(smoothedRate(selectedTarget.successes, selectedTarget.attempts) * 100).toFixed(0)}%
              </div>
              <Link
                to={`/nodes/${selectedTarget.node_id}`}
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
      {selectedHeardGhost && (
        <Popup
          longitude={selectedHeardGhost.lng}
          latitude={selectedHeardGhost.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedHeardGhost(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[180px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => setSelectedHeardGhost(null)}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="pr-5">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Heard (no traceroute row)
              </div>
              <div className="mt-0.5 font-semibold">{ghostLabel(selectedHeardGhost)}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {selectedHeardGhost.node_id_str || `!${selectedHeardGhost.node_id.toString(16)}`}
              </div>
              <Link
                to={`/nodes/${selectedHeardGhost.node_id}`}
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
      {selectedFeederMarker && selectedFeederMarker.lat != null && selectedFeederMarker.lng != null && (
        <Popup
          longitude={selectedFeederMarker.lng}
          latitude={selectedFeederMarker.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedFeederMarker(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[180px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => setSelectedFeederMarker(null)}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="pr-5">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-400">Managed node (feeder)</div>
              <div className="mt-0.5 font-semibold">{feederPopupTitle(selectedFeederMarker)}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {selectedFeederMarker.node_id_str || `!${selectedFeederMarker.node_id.toString(16)}`}
              </div>
              <Link
                to={`/nodes/${selectedFeederMarker.node_id}`}
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
    </DeckMapboxMap>
  );
}
