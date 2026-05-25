import { formatDistanceToNow, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { nodeDetailPath } from '@/lib/node-detail-routes';
import { X } from 'lucide-react';
import { getHeatmapNodeLabel } from '@/components/traceroutes/heatmapEncoding';
import type { HeatmapNode } from '@/hooks/api/useHeatmapEdges';

function formatRecency(iso: string | null | undefined): string {
  if (!iso) return 'No recent mesh observation';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export interface TracerouteHeatmapNodePanelProps {
  node: HeatmapNode;
  onClose?: () => void;
  /** Optional link shown below “Open details” (e.g. topology ↔ map with preserved params). */
  secondaryLink?: { to: string; label: string };
  className?: string;
}

export function TracerouteHeatmapNodePanel({
  node,
  onClose,
  secondaryLink,
  className,
}: TracerouteHeatmapNodePanelProps) {
  return (
    <div
      className={
        className ??
        'relative min-w-[120px] rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-lg'
      }
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <div className={onClose ? 'pr-5' : undefined}>
        <div className="font-semibold">
          {node.long_name && node.short_name ? `${node.long_name} (${node.short_name})` : getHeatmapNodeLabel(node)}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          {node.node_id_str || `!${node.meshtastic_node_id.toString(16)}`}
        </div>
        {(node.centrality != null || node.degree != null) && (
          <dl className="mt-2 space-y-0.5 text-xs text-slate-300">
            {node.centrality != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Centrality</dt>
                <dd>{(node.centrality * 100).toFixed(1)}%</dd>
              </div>
            )}
            {node.degree != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Degree</dt>
                <dd>{node.degree}</dd>
              </div>
            )}
            {node.role && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Role</dt>
                <dd className="capitalize">{node.role}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="mt-1.5 text-xs text-slate-400">
          Last seen: <span className="text-slate-300">{formatRecency(node.last_seen)}</span>
        </div>
        <Link
          to={
            nodeDetailPath({
              meshtastic_node_id: node.meshtastic_node_id,
              node_id_str: node.node_id_str,
              protocol: 1,
            }) ?? '#'
          }
          className="mt-1 inline-block text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          Open details
        </Link>
        {secondaryLink && (
          <Link
            to={secondaryLink.to}
            className="mt-1 ml-2 inline-block text-xs text-sky-400 hover:text-sky-300 hover:underline"
          >
            {secondaryLink.label}
          </Link>
        )}
      </div>
    </div>
  );
}
