import { Link } from 'react-router-dom';
import { Battery } from 'lucide-react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { ObservedNode } from '@/lib/models';
import { observedNodeDetailPath } from '@/lib/node-detail-routes';
import { getRoleLabel } from '@/lib/meshtastic';
import { describeBattery } from '@/lib/battery';
import { cn } from '@/lib/utils';

interface NodeCardProps {
  node: ObservedNode;
}

const TEXT_TONE = { good: 'text-emerald-500', warn: 'text-amber-500', low: 'text-red-500' } as const;
const BAR_TONE = { good: 'bg-emerald-500', warn: 'bg-amber-500', low: 'bg-red-500' } as const;

/** Raw device-metrics battery level; 101 is shown as "Powered" (see `describeBattery`). */
export function BatteryIndicator({ level }: { level: number }) {
  const d = describeBattery(level);
  if (d.kind === 'none') return null;
  if (d.kind === 'powered') {
    return (
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground">Powered</span>
        <Battery className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 ml-auto">
      <div className="flex items-center gap-2 w-20">
        <div className="flex-1 min-w-0 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', BAR_TONE[d.tone])} style={{ width: `${d.pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{d.pct}%</span>
      </div>
      <Battery className={cn('h-4 w-4 shrink-0', TEXT_TONE[d.tone])} aria-hidden />
    </div>
  );
}

export function NodeCard({ node }: NodeCardProps) {
  const batteryLevel = node.latest_device_metrics?.battery_level ?? null;
  const roleLabel = getRoleLabel(node.meshtastic_role);
  const detailPath = observedNodeDetailPath(node);

  if (!detailPath) {
    return null;
  }

  return (
    <Link
      key={node.meshtastic_node_id}
      to={detailPath}
      className="block p-5 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-200 dark:border-slate-700"
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{node.short_name}</h2>
          {node.long_name && <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{node.long_name}</p>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <StaleReportedTime at={node.last_heard ?? null} fallback="Never" className="text-inherit" />
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">{node.node_id_str}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
        {roleLabel && <span>{roleLabel}</span>}
        {node.owner && <span>Owner: {node.owner.username}</span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
        {node.meshtastic_hw_model && <span>{node.meshtastic_hw_model}</span>}
        {batteryLevel != null && <BatteryIndicator level={batteryLevel} />}
      </div>
    </Link>
  );
}
