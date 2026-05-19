import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { HeatmapEdge, HeatmapNode } from '@/hooks/api/useHeatmapEdges';
import {
  computeHeatmapArcEncoding,
  computeHeatmapNodeExtents,
  degreeFillColor,
  edgeArcColor,
  edgeArcWidth,
  getHeatmapNodeLabel,
  HEATMAP_NODE_COLOR_FALLBACK,
  nodeLineColor,
  nodeLineWidth,
  nodeRadiusPixels,
  staleThresholdMs,
} from '@/components/traceroutes/heatmapEncoding';
type EdgeMetric = 'packets' | 'snr';

type SimNode = HeatmapNode & { x?: number; y?: number; vx?: number; vy?: number; index?: number };

interface GraphLink {
  source: SimNode;
  target: SimNode;
  edge: HeatmapEdge;
}

function deterministicSeedXY(nodeId: number, w: number, h: number): { x: number; y: number } {
  let s = nodeId >>> 0;
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  const u1 = s / 0xffffffff;
  s = (Math.imul(s ^ nodeId, 22695477) + 1) >>> 0;
  const u2 = s / 0xffffffff;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.35;
  return { x: cx + (u1 - 0.5) * 2 * r, y: cy + (u2 - 0.5) * 2 * r };
}

function linkStrengthValue(edge: HeatmapEdge, enc: NonNullable<ReturnType<typeof computeHeatmapArcEncoding>>): number {
  const v = enc.valueKey === 'avg_snr' ? (edge.avg_snr ?? enc.minVal) : edge.weight;
  const t = (v - enc.minVal) / Math.max(enc.maxVal - enc.minVal, 1e-9);
  return Math.min(1, Math.max(0, t));
}

/** Screen-space font px; scales slightly when zoomed out so labels stay usable. */
function topologyLabelFontPx(viewScale: number): number {
  return Math.round(Math.max(9, Math.min(13, 10 + Math.log2(Math.max(viewScale, 0.05)) * 1.5)));
}

function truncateTopologyLabel(raw: string): string {
  if (raw.length <= 28) return raw;
  return `${raw.slice(0, 26)}…`;
}

export interface TracerouteTopologyGraphProps {
  edges: HeatmapEdge[];
  nodes: HeatmapNode[];
  edgeMetric: EdgeMetric;
  staleThresholdHours: number;
  intensity?: number;
  onSelectedNodeChange: (node: HeatmapNode | null) => void;
  /** Deep-link sync */
  selectedNodeId: number | null;
}

export function TracerouteTopologyGraph({
  edges,
  nodes,
  edgeMetric,
  staleThresholdHours,
  intensity = 0.7,
  onSelectedNodeChange,
  selectedNodeId,
}: TracerouteTopologyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warmRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [liveMsg, setLiveMsg] = useState('');

  const staleMs = staleThresholdMs(staleThresholdHours);
  const nodeExtents = useMemo(() => computeHeatmapNodeExtents(nodes), [nodes]);
  const arcEnc = useMemo(() => computeHeatmapArcEncoding(edges, edgeMetric, intensity), [edges, edgeMetric, intensity]);

  const roleById = useMemo(() => {
    const m = new Map<number, HeatmapNode['role']>();
    for (const n of nodes) m.set(n.meshtastic_node_id, n.role);
    return m;
  }, [nodes]);

  const adjacency = useMemo(() => {
    const m = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const e of edges) {
      add(e.from_node_id, e.to_node_id);
      add(e.to_node_id, e.from_node_id);
    }
    return m;
  }, [edges]);

  const sortedIds = useMemo(() => [...nodes.map((n) => n.meshtastic_node_id)].sort((a, b) => a - b), [nodes]);

  const simulationNodesRef = useRef<SimNode[]>([]);
  const simulationLinksRef = useRef<GraphLink[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && cr.width > 0 && cr.height > 0) {
        setDimensions({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    }
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const { width, height } = dimensions;
    if (width < 32 || height < 32 || nodes.length === 0) {
      simulationNodesRef.current = [];
      simulationLinksRef.current = [];
      return;
    }

    const byId = new Map(nodes.map((n) => [n.meshtastic_node_id, { ...n } as SimNode]));
    const simNodes: SimNode[] = nodes.map((n) => {
      const prev = warmRef.current.get(n.meshtastic_node_id);
      const seed = deterministicSeedXY(n.meshtastic_node_id, width, height);
      return {
        ...n,
        x: prev?.x ?? seed.x,
        y: prev?.y ?? seed.y,
      };
    });

    for (const sn of simNodes) {
      byId.set(sn.meshtastic_node_id, sn);
    }

    const linkObjs: GraphLink[] = [];
    for (const e of edges) {
      const s = byId.get(e.from_node_id);
      const t = byId.get(e.to_node_id);
      if (s && t) linkObjs.push({ source: s, target: t, edge: e });
    }

    const enc = arcEnc;
    const minD = 18;
    const maxD = 140;
    const simulation = d3
      .forceSimulation(simNodes as SimNode[])
      .force(
        'link',
        d3
          .forceLink<SimNode, GraphLink>(linkObjs)
          .id((d) => d.meshtastic_node_id)
          .distance((d) => {
            if (!enc) return (minD + maxD) / 2;
            const t = linkStrengthValue(d.edge, enc);
            return maxD - t * (maxD - minD);
          })
          .strength(0.55)
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-120).theta(0.9))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) => {
          const r = nodeExtents.hasSignal
            ? nodeRadiusPixels(d.centrality, nodeExtents.cExt.min, nodeExtents.cExt.max)
            : 11;
          return r + 3;
        })
      )
      .alpha(0.35)
      .alphaDecay(0.052)
      .velocityDecay(0.55);

    let ticks = 0;
    while (simulation.alpha() > 0.02 && ticks < 280) {
      simulation.tick();
      ticks += 1;
    }
    simulation.stop();

    for (const n of simNodes) {
      if (n.x != null && n.y != null) {
        warmRef.current.set(n.meshtastic_node_id, { x: n.x, y: n.y });
      }
    }

    simulationNodesRef.current = simNodes;
    simulationLinksRef.current = linkObjs;
  }, [nodes, edges, dimensions, arcEnc, nodeExtents, edgeMetric]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = dimensions;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const simNodes = simulationNodesRef.current;
    const linkObjs = simulationLinksRef.current;
    const enc = arcEnc;
    const nowMs = Date.now();
    const { cExt, dExt, hasSignal } = nodeExtents;

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const highlight = hoverId ?? selectedNodeId;
    const neigh = highlight != null ? adjacency.get(highlight) : null;

    const edgeFade = (a: number, b: number) => {
      if (highlight == null) return 1;
      const touches = a === highlight || b === highlight || neigh?.has(a) || neigh?.has(b);
      return touches ? 1 : 0.12;
    };

    const nodeFade = (id: number) => {
      if (highlight == null) return 1;
      if (id === highlight) return 1;
      if (neigh?.has(id)) return 1;
      return 0.22;
    };

    for (const L of linkObjs) {
      const a = L.source;
      const b = L.target;
      if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
      const alphaMul = edgeFade(a.meshtastic_node_id, b.meshtastic_node_id);
      const touchesLeaf =
        roleById.get(a.meshtastic_node_id) === 'leaf' || roleById.get(b.meshtastic_node_id) === 'leaf';
      let stroke: [number, number, number, number];
      let lw: number;
      if (touchesLeaf) {
        stroke = [142, 142, 148, 200];
        lw = enc ? edgeArcWidth(L.edge, enc) : 1.5;
      } else if (enc) {
        stroke = edgeArcColor(L.edge, enc);
        lw = edgeArcWidth(L.edge, enc);
      } else {
        stroke = [148, 163, 184, 180];
        lw = 1.5;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${stroke[0]},${stroke[1]},${stroke[2]},${(stroke[3] / 255) * alphaMul})`;
      ctx.lineWidth = Math.max(0.6, lw * 0.35);
      if (touchesLeaf) ctx.setLineDash([6, 5]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const nodeDrawOrder = [...simNodes].sort((u, v) => {
      if (highlight == null) return 0;
      if (u.meshtastic_node_id === highlight) return 1;
      if (v.meshtastic_node_id === highlight) return -1;
      return 0;
    });

    for (const n of nodeDrawOrder) {
      if (n.x == null || n.y == null) continue;
      const r = hasSignal ? nodeRadiusPixels(n.centrality, cExt.min, cExt.max) : 9;
      const fill = hasSignal ? degreeFillColor(n, dExt.min, dExt.max, nowMs, staleMs) : HEATMAP_NODE_COLOR_FALLBACK;
      const strokeCol = nodeLineColor(fill);
      const fade = nodeFade(n.meshtastic_node_id);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},${(fill[3] / 255) * fade})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${strokeCol[0]},${strokeCol[1]},${strokeCol[2]},${(strokeCol[3] / 255) * fade})`;
      ctx.lineWidth = hasSignal ? nodeLineWidth(n, dExt.min, dExt.max) : 1;
      ctx.stroke();
    }

    ctx.restore();

    // Labels in CSS pixel space so they stay readable at every zoom level (constant-ish screen size).
    const labelPx = topologyLabelFontPx(transform.k);
    ctx.font = `${labelPx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const n of nodeDrawOrder) {
      if (n.x == null || n.y == null) continue;
      const gx = n.x * transform.k + transform.x;
      const gy = n.y * transform.k + transform.y;
      const rPx = (hasSignal ? nodeRadiusPixels(n.centrality, cExt.min, cExt.max) : 9) * transform.k;
      const fade = nodeFade(n.meshtastic_node_id);
      const label = truncateTopologyLabel(getHeatmapNodeLabel(n));
      const ty = gy + rPx + labelPx * 0.65 + 2;
      ctx.strokeStyle = `rgba(15, 23, 42, ${0.92 * fade})`;
      ctx.lineWidth = Math.max(3, labelPx * 0.35);
      ctx.lineJoin = 'round';
      ctx.strokeText(label, gx, ty);
      ctx.fillStyle = `rgba(226, 232, 240, ${fade})`;
      ctx.fillText(label, gx, ty);
    }
  }, [dimensions, transform, arcEnc, nodeExtents, staleMs, hoverId, selectedNodeId, adjacency, roleById]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const z = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 12])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
    const sel = d3.select(canvas);
    sel.call(z);
    return () => {
      sel.on('.zoom', null);
    };
  }, []);

  const pickNode = useCallback(
    (clientX: number, clientY: number): HeatmapNode | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const graphX = (px - transform.x) / transform.k;
      const graphY = (py - transform.y) / transform.k;
      const simNodes = simulationNodesRef.current;
      const { cExt, hasSignal } = nodeExtents;
      let best: HeatmapNode | null = null;
      let bestD = Infinity;
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const r = (hasSignal ? nodeRadiusPixels(n.centrality, cExt.min, cExt.max) : 9) + 6 / transform.k;
        const dx = n.x - graphX;
        const dy = n.y - graphY;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r && d2 < bestD) {
          bestD = d2;
          best = n;
        }
      }
      return best;
    },
    [transform, nodeExtents]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const n = pickNode(e.clientX, e.clientY);
      setHoverId(n?.meshtastic_node_id ?? null);
    },
    [pickNode]
  );

  const onPointerLeave = useCallback(() => setHoverId(null), []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const n = pickNode(e.clientX, e.clientY);
      onSelectedNodeChange(n);
      if (n) setLiveMsg(`${n.short_name ?? n.node_id_str ?? n.meshtastic_node_id} selected`);
    },
    [pickNode, onSelectedNodeChange]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (sortedIds.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((i) => (i + 1) % sortedIds.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((i) => (i - 1 + sortedIds.length) % sortedIds.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = sortedIds[focusIndex];
        const node = nodes.find((n) => n.meshtastic_node_id === id) ?? null;
        onSelectedNodeChange(node);
        if (node) setLiveMsg(`${node.short_name ?? node.node_id_str ?? node.meshtastic_node_id} selected`);
      }
    },
    [sortedIds, focusIndex, nodes, onSelectedNodeChange]
  );

  useEffect(() => {
    const id = sortedIds[focusIndex];
    const node = nodes.find((n) => n.meshtastic_node_id === id);
    if (node && document.activeElement?.getAttribute('data-testid') === 'topology-canvas') {
      setLiveMsg(`Focused ${node.short_name ?? node.node_id_str ?? id}`);
    }
  }, [focusIndex, sortedIds, nodes]);

  const empty = edges.length === 0 || nodes.length === 0;

  return (
    <div ref={containerRef} className="relative h-full min-h-[300px] w-full md:min-h-[calc(100dvh-16rem)]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Traceroute topology graph. Use arrow keys to focus nodes, Enter to select."
        tabIndex={0}
        data-testid="topology-canvas"
        className="absolute inset-0 h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No edges to display for the current filters.
        </div>
      )}
      <ul className="sr-only" aria-hidden>
        {nodes.map((n) => (
          <li key={n.meshtastic_node_id}>{n.short_name ?? n.node_id_str ?? n.meshtastic_node_id}</li>
        ))}
      </ul>
      <div className="sr-only" aria-live="polite">
        {liveMsg}
      </div>
    </div>
  );
}
