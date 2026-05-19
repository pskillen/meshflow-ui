import { useCallback, useMemo, useState } from 'react';
import { Popup } from 'react-map-gl/mapbox';
import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { X } from 'lucide-react';

import { buildFeederIconLayer } from '@/components/map/FeederIconLayer';
import { DeckMapboxMap } from '@/components/map/DeckMapboxMap';
import type { GeoClassification, ManagedNode, ObservedNode } from '@/lib/models';
import {
  buildCirclePolygon,
  buildWedgePolygon,
  classifyCandidate,
  classifyForAuto,
  type ClassifyContext,
  type ExclusionReason,
  suggestedWedgeRadiusKm,
  type TargetPreviewStrategy,
} from '@/lib/tracerouteTargetGeometry';

type PlotRow = { node: ObservedNode; lng: number; lat: number };

const INTRA_FILL: [number, number, number, number] = [34, 197, 94, 55];
const INTRA_LINE: [number, number, number, number] = [22, 163, 74, 220];
const DX_ACROSS_FILL: [number, number, number, number] = [59, 130, 246, 60];
const DX_ACROSS_LINE: [number, number, number, number] = [37, 99, 235, 220];
const DX_SAME_FILL: [number, number, number, number] = [245, 158, 11, 55];
const DX_SAME_LINE: [number, number, number, number] = [217, 119, 6, 220];

function nodeLabel(n: ObservedNode): string {
  return n.short_name ?? n.long_name ?? n.node_id_str ?? String(n.node_id);
}

function reasonLabel(r: ExclusionReason): string {
  switch (r) {
    case 'included':
      return 'Included in pool for the active strategy';
    case 'no_position':
      return 'No latest position';
    case 'stale_last_heard':
      return 'Outside last-heard window';
    case 'is_managed':
      return 'Managed node (excluded from auto targets)';
    case 'is_source':
      return 'Source node';
    case 'outside_envelope':
      return 'Outside intra-zone envelope';
    case 'inside_envelope':
      return 'Inside envelope (excluded for DX strategies)';
    case 'outside_wedge':
      return 'Outside DX wedge for this half-window';
    default:
      return r;
  }
}

export interface AutoTargetPreviewMapProps {
  feeder: ManagedNode;
  candidates: ObservedNode[];
  managedNodeIds: Set<number>;
  strategy: TargetPreviewStrategy;
  halfWindowDeg: number;
}

export function AutoTargetPreviewMap({
  feeder,
  candidates,
  managedNodeIds,
  strategy,
  halfWindowDeg,
}: AutoTargetPreviewMapProps) {
  const [picked, setPicked] = useState<ObservedNode | null>(null);

  const geo = feeder.geo_classification;
  const feederLat = feeder.position?.latitude;
  const feederLng = feeder.position?.longitude;

  const classifyCtx = useMemo((): ClassifyContext | null => {
    if (!geo?.selector_params || feederLat == null || feederLng == null) return null;
    const mergedGeo: GeoClassification = {
      tier: geo.tier,
      bearing_octant: geo.bearing_octant ?? null,
      applicable_strategies: geo.applicable_strategies ?? [],
      envelope: geo.envelope ?? null,
      selection_centroid: geo.selection_centroid ?? null,
      source_bearing_deg: geo.source_bearing_deg ?? null,
      selector_params: geo.selector_params,
    };
    const hours = mergedGeo.selector_params!.last_heard_within_hours;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return {
      feederNodeId: feeder.node_id,
      managedNodeIds,
      lastHeardCutoff: cutoff,
      geo: mergedGeo,
      feederLat,
      feederLon: feederLng,
    };
  }, [feeder.node_id, feederLat, feederLng, geo, managedNodeIds]);

  const { envelope, centroid } = useMemo(() => {
    const env = geo?.envelope ?? null;
    const cen = geo?.selection_centroid ?? (env ? { lat: env.centroid_lat, lon: env.centroid_lon } : null);
    return { envelope: env, centroid: cen };
  }, [geo?.envelope, geo?.selection_centroid]);

  const wedgeRadiusKm = useMemo(() => {
    if (!centroid || feederLat == null || feederLng == null) return 200;
    return suggestedWedgeRadiusKm(feederLat, feederLng, centroid, envelope ?? null, candidates);
  }, [candidates, centroid, envelope, feederLat, feederLng]);

  const regionData = useMemo(() => {
    if (!geo || !centroid || feederLat == null || feederLng == null) return [];
    const rows: {
      id: string;
      polygon: [number, number][];
      fill: [number, number, number, number];
      line: [number, number, number, number];
    }[] = [];
    const applicable = geo.applicable_strategies ?? [];
    const showIntra = envelope && (strategy === 'auto' ? applicable.includes('intra_zone') : strategy === 'intra_zone');
    const showDxAcross = strategy === 'auto' ? applicable.includes('dx_across') : strategy === 'dx_across';
    const showDxSame = strategy === 'auto' ? applicable.includes('dx_same_side') : strategy === 'dx_same_side';

    if (showIntra && envelope) {
      rows.push({
        id: 'intra',
        polygon: buildCirclePolygon(envelope.centroid_lat, envelope.centroid_lon, envelope.radius_km),
        fill: INTRA_FILL,
        line: INTRA_LINE,
      });
    }
    const brSrc = geo.source_bearing_deg;
    if (brSrc != null) {
      if (showDxAcross) {
        const center = (brSrc + 180) % 360;
        rows.push({
          id: 'dx_across',
          polygon: buildWedgePolygon(centroid.lat, centroid.lon, center, halfWindowDeg, wedgeRadiusKm),
          fill: DX_ACROSS_FILL,
          line: DX_ACROSS_LINE,
        });
      }
      if (showDxSame) {
        rows.push({
          id: 'dx_same',
          polygon: buildWedgePolygon(centroid.lat, centroid.lon, brSrc, halfWindowDeg, wedgeRadiusKm),
          fill: DX_SAME_FILL,
          line: DX_SAME_LINE,
        });
      }
    }
    return rows;
  }, [centroid, envelope, feederLat, feederLng, geo, halfWindowDeg, strategy, wedgeRadiusKm]);

  const { includedData, excludedData } = useMemo(() => {
    if (!classifyCtx || !geo) {
      return { includedData: [] as ObservedNode[], excludedData: [] as ObservedNode[] };
    }
    const applicable = geo.applicable_strategies ?? ['dx_across', 'dx_same_side'];
    const classifyOne = (n: ObservedNode) =>
      strategy === 'auto'
        ? classifyForAuto(n, classifyCtx, applicable, halfWindowDeg)
        : classifyCandidate(n, classifyCtx, strategy, halfWindowDeg);

    const included: ObservedNode[] = [];
    const excluded: ObservedNode[] = [];
    for (const n of candidates) {
      const r = classifyOne(n);
      if (r.included) included.push(n);
      else excluded.push(n);
    }
    return { includedData: included, excludedData: excluded };
  }, [candidates, classifyCtx, geo, halfWindowDeg, strategy]);

  const positions = useMemo((): PlotRow[] => {
    return [...includedData, ...excludedData]
      .map((n) => {
        const lat = n.latest_position?.latitude;
        const lng = n.latest_position?.longitude;
        if (lat == null || lng == null) return null;
        return { node: n, lng, lat };
      })
      .filter((x): x is PlotRow => x != null);
  }, [excludedData, includedData]);

  const includedSet = useMemo(() => new Set(includedData.map((n) => n.node_id)), [includedData]);

  const excludedLayer = useMemo(() => {
    const data = positions.filter((p) => !includedSet.has(p.node.node_id));
    if (data.length === 0) return null;
    return new ScatterplotLayer<PlotRow>({
      id: 'auto-target-excluded',
      data,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 3,
      radiusUnits: 'pixels',
      filled: false,
      stroked: true,
      lineWidthMinPixels: 1.2,
      getLineColor: [100, 116, 139, 220],
      pickable: true,
    });
  }, [includedSet, positions]);

  const includedLayer = useMemo(() => {
    const data = positions.filter((p) => includedSet.has(p.node.node_id));
    if (data.length === 0) return null;
    return new ScatterplotLayer<PlotRow>({
      id: 'auto-target-included',
      data,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 7,
      radiusUnits: 'pixels',
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getFillColor: [15, 118, 110, 230],
      getLineColor: [6, 78, 59, 240],
      pickable: true,
    });
  }, [includedSet, positions]);

  const polygonLayer = useMemo(() => {
    if (regionData.length === 0) return null;
    return new PolygonLayer<(typeof regionData)[0]>({
      id: 'auto-target-regions',
      data: regionData,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => d.fill,
      getLineColor: (d) => d.line,
      lineWidthMinPixels: 1.5,
      stroked: true,
      filled: true,
      pickable: false,
    });
  }, [regionData]);

  const feederLayer = useMemo(() => {
    if (feederLat == null || feederLng == null) return null;
    return buildFeederIconLayer(
      [
        {
          lat: feederLat,
          lng: feederLng,
          node_id: feeder.node_id,
          node_id_str: feeder.node_id_str,
          short_name: feeder.short_name,
          long_name: feeder.long_name,
          managed_node_id: String(feeder.node_id),
        },
      ],
      { id: 'auto-target-feeder-icons', size: 36, pickable: true }
    );
  }, [feeder, feederLat, feederLng]);

  const layers = useMemo(
    () => [polygonLayer, excludedLayer, includedLayer, feederLayer].filter(Boolean) as Layer[],
    [polygonLayer, excludedLayer, includedLayer, feederLayer]
  );

  const initialViewState = useMemo(() => {
    if (feederLat != null && feederLng != null) {
      return { longitude: feederLng, latitude: feederLat, zoom: 9 };
    }
    if (centroid) {
      return { longitude: centroid.lon, latitude: centroid.lat, zoom: 8 };
    }
    return { longitude: -4.25, latitude: 55.0, zoom: 8 };
  }, [centroid, feederLat, feederLng]);

  const handleClick = useCallback((info: PickingInfo) => {
    const lid = info.layer?.id;
    if ((lid === 'auto-target-included' || lid === 'auto-target-excluded') && info.object) {
      setPicked((info.object as { node: ObservedNode }).node);
      return;
    }
    setPicked(null);
  }, []);

  if (!geo?.selector_params) {
    return (
      <div
        className="flex min-h-[220px] items-center justify-center rounded-md border bg-muted/30 px-4 text-center text-sm text-muted-foreground"
        data-testid="auto-target-preview-unavailable"
      >
        Geo preview needs meshflow-api geo_classification fields (envelope, selection_centroid, selector_params). Update
        the API and refetch managed nodes.
      </div>
    );
  }

  if (feederLat == null || feederLng == null) {
    return (
      <div
        className="flex min-h-[220px] items-center justify-center rounded-md border bg-muted/30 px-4 text-center text-sm text-muted-foreground"
        data-testid="auto-target-preview-unavailable"
      >
        Source node has no map position. Set a default location or wait for an observed position.
      </div>
    );
  }

  const pickedClassification =
    picked && classifyCtx && geo
      ? strategy === 'auto'
        ? classifyForAuto(picked, classifyCtx, geo.applicable_strategies ?? [], halfWindowDeg)
        : classifyCandidate(picked, classifyCtx, strategy, halfWindowDeg)
      : null;

  return (
    <div className="space-y-2" data-testid="auto-target-preview-map">
      <div className="h-[280px] overflow-hidden rounded-md border">
        <DeckMapboxMap
          layers={layers}
          initialViewState={initialViewState}
          onClick={handleClick}
          data-testid="auto-target-preview-deck"
        >
          {picked && pickedClassification && (
            <Popup
              longitude={picked.latest_position!.longitude!}
              latitude={picked.latest_position!.latitude!}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              onClose={() => setPicked(null)}
              maxWidth="280px"
              className="meshflow-map-popup"
            >
              <div className="relative min-w-[160px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg">
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
                <div className="pr-5 font-semibold">{nodeLabel(picked)}</div>
                <div className="mt-1 text-xs text-slate-400">{pickedClassification.reason}</div>
                <div className="mt-1 text-xs text-slate-300">{reasonLabel(pickedClassification.reason)}</div>
              </div>
            </Popup>
          )}
        </DeckMapboxMap>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          Intra-zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500/80" />
          DX across
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          DX same side
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-teal-600" title="Candidate" />
          Candidate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-400 bg-transparent" />
          Excluded
        </span>
      </div>
    </div>
  );
}
