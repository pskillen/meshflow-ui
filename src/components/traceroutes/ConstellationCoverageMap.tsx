import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { Popup } from 'react-map-gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { X } from 'lucide-react';

import { buildFeederIconLayer, type FeederIconDatum } from '@/components/map/FeederIconLayer';
import {
  attemptsToRadius,
  LOW_CONFIDENCE_COLOR,
  reliabilityColor,
  smoothedRate,
} from '@/components/map/coverageStyling';
import { DeckMapboxMap } from '@/components/map/DeckMapboxMap';
import type { ConstellationCoverageHex, ConstellationCoverageTarget } from '@/lib/api/meshflow-api';
import type { CoverageHeardGhost } from '@/lib/coverageHeardGhosts';

const DEFAULT_CENTER = { longitude: -4.2518, latitude: 55.8642, zoom: 7 };

export type ConstellationMapLayerKey = 'hex' | 'dots' | 'feeders' | 'heard';

export interface SmoothedHex extends ConstellationCoverageHex {
  smoothed: number;
}

function getTargetLabel(t: ConstellationCoverageTarget): string {
  return t.short_name || t.long_name || t.node_id_str || `!${t.meshtastic_node_id.toString(16)}`;
}

function feederLabel(f: FeederIconDatum): string {
  return f.short_name || f.long_name || f.node_id_str || `!${f.meshtastic_node_id.toString(16)}`;
}

function ghostLabel(g: CoverageHeardGhost): string {
  return g.short_name || g.long_name || g.node_id_str || `!${g.meshtastic_node_id.toString(16)}`;
}

export interface ConstellationCoverageMapProps {
  hexes: ConstellationCoverageHex[];
  targets?: ConstellationCoverageTarget[];
  feeders?: FeederIconDatum[];
  heardGhosts: CoverageHeardGhost[];
  enabledLayers: ConstellationMapLayerKey[];
  minAttempts: number;
}

export function ConstellationCoverageMap({
  hexes,
  targets = [],
  feeders = [],
  heardGhosts,
  enabledLayers,
  minAttempts,
}: ConstellationCoverageMapProps) {
  const [selectedHex, setSelectedHex] = useState<SmoothedHex | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ConstellationCoverageTarget | null>(null);
  const [selectedFeeder, setSelectedFeeder] = useState<FeederIconDatum | null>(null);
  const [selectedHeardGhost, setSelectedHeardGhost] = useState<CoverageHeardGhost | null>(null);

  const enabledSet = useMemo(() => new Set(enabledLayers), [enabledLayers]);

  const smoothedHexes: SmoothedHex[] = useMemo(
    () =>
      hexes.map((h) => ({
        ...h,
        smoothed: smoothedRate(h.successes, h.attempts),
      })),
    [hexes]
  );

  const hexLayer = useMemo(() => {
    if (!enabledSet.has('hex') || smoothedHexes.length === 0) return null;
    return new H3HexagonLayer<SmoothedHex>({
      id: 'constellation-coverage-hex',
      data: smoothedHexes,
      getHexagon: (d) => d.h3_index,
      extruded: false,
      stroked: true,
      filled: true,
      getFillColor: (d) => (d.attempts < minAttempts ? LOW_CONFIDENCE_COLOR : reliabilityColor(d.smoothed, 160)),
      getLineColor: [15, 23, 42, 180],
      lineWidthMinPixels: 1,
      pickable: true,
    });
  }, [smoothedHexes, minAttempts, enabledSet]);

  const dotsLayer = useMemo(() => {
    if (!enabledSet.has('dots') || targets.length === 0) return null;
    return new ScatterplotLayer<ConstellationCoverageTarget>({
      id: 'constellation-coverage-dots',
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

  const heardGhostsLayer = useMemo(() => {
    if (!enabledSet.has('heard') || heardGhosts.length === 0) return null;
    return new ScatterplotLayer<CoverageHeardGhost>({
      id: 'constellation-coverage-heard-ghosts',
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
    if (!enabledSet.has('feeders') || feeders.length === 0) return null;
    const positioned = feeders.filter((f) => f.lat != null && f.lng != null);
    if (positioned.length === 0) return null;
    return buildFeederIconLayer(positioned, {
      id: 'constellation-feeder-tower-icons',
      size: 38,
      pickable: true,
    });
  }, [enabledSet, feeders]);

  const layers = useMemo(
    () => [hexLayer, heardGhostsLayer, dotsLayer, feederIconLayer].filter(Boolean) as Layer[],
    [hexLayer, heardGhostsLayer, dotsLayer, feederIconLayer]
  );

  const handleClick = useCallback((info: PickingInfo) => {
    const lid = info.layer?.id;
    if (lid === 'constellation-feeder-tower-icons' && info.object) {
      setSelectedFeeder(info.object as FeederIconDatum);
      setSelectedHex(null);
      setSelectedTarget(null);
      setSelectedHeardGhost(null);
      return;
    }
    if (lid === 'constellation-coverage-dots' && info.object) {
      setSelectedTarget(info.object as ConstellationCoverageTarget);
      setSelectedHex(null);
      setSelectedFeeder(null);
      setSelectedHeardGhost(null);
      return;
    }
    if (lid === 'constellation-coverage-heard-ghosts' && info.object) {
      setSelectedHeardGhost(info.object as CoverageHeardGhost);
      setSelectedHex(null);
      setSelectedTarget(null);
      setSelectedFeeder(null);
      return;
    }
    if (lid === 'constellation-coverage-hex' && info.object) {
      setSelectedHex(info.object as SmoothedHex);
      setSelectedTarget(null);
      setSelectedFeeder(null);
      setSelectedHeardGhost(null);
      return;
    }
    setSelectedHex(null);
    setSelectedTarget(null);
    setSelectedFeeder(null);
    setSelectedHeardGhost(null);
  }, []);

  return (
    <DeckMapboxMap
      layers={layers}
      initialViewState={DEFAULT_CENTER}
      onClick={handleClick}
      data-testid="constellation-coverage-map-container"
    >
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
                {selectedHeardGhost.node_id_str || `!${selectedHeardGhost.meshtastic_node_id.toString(16)}`}
              </div>
              <Link
                to={
                  nodeDetailPath({
                    meshtastic_node_id: selectedHeardGhost.meshtastic_node_id,
                    node_id_str: selectedHeardGhost.node_id_str,
                    protocol: 1,
                  }) ?? '#'
                }
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
      {selectedHex && (
        <Popup
          longitude={selectedHex.centre_lng}
          latitude={selectedHex.centre_lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedHex(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[200px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => setSelectedHex(null)}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="pr-5">
              <div className="font-mono text-xs text-slate-400">{selectedHex.h3_index}</div>
              <div className="mt-1 text-xs">
                {selectedHex.successes} / {selectedHex.attempts} (
                {((selectedHex.attempts > 0 ? selectedHex.successes / selectedHex.attempts : 0) * 100).toFixed(0)}% raw)
              </div>
              <div className="text-xs">Smoothed: {(selectedHex.smoothed * 100).toFixed(0)}%</div>
              <div className="mt-1 text-xs text-slate-400">
                {selectedHex.contributing_feeders} feeder{selectedHex.contributing_feeders === 1 ? '' : 's'},{' '}
                {selectedHex.contributing_targets} target{selectedHex.contributing_targets === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </Popup>
      )}
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
                {selectedTarget.node_id_str || `!${selectedTarget.meshtastic_node_id.toString(16)}`}
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
              <div className="text-xs text-slate-400">
                {selectedTarget.contributing_feeders} contributing feeder
                {selectedTarget.contributing_feeders === 1 ? '' : 's'}
              </div>
              <Link
                to={
                  nodeDetailPath({
                    meshtastic_node_id: selectedTarget.meshtastic_node_id,
                    node_id_str: selectedTarget.node_id_str,
                    protocol: 1,
                  }) ?? '#'
                }
                className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Open details
              </Link>
            </div>
          </div>
        </Popup>
      )}
      {selectedFeeder && (
        <Popup
          longitude={selectedFeeder.lng}
          latitude={selectedFeeder.lat}
          anchor="bottom"
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelectedFeeder(null)}
          maxWidth="320px"
          className="meshflow-map-popup"
        >
          <div className="relative min-w-[180px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
            <button
              type="button"
              onClick={() => setSelectedFeeder(null)}
              className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="pr-5">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-400">Managed node (feeder)</div>
              <div className="mt-0.5 font-semibold">{feederLabel(selectedFeeder)}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {selectedFeeder.node_id_str || `!${selectedFeeder.meshtastic_node_id.toString(16)}`}
              </div>
              <Link
                to={
                  nodeDetailPath({
                    meshtastic_node_id: selectedFeeder.meshtastic_node_id,
                    node_id_str: selectedFeeder.node_id_str,
                    protocol: 1,
                  }) ?? '#'
                }
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
