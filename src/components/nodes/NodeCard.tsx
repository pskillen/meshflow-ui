import { Link } from 'react-router-dom';
import { Battery } from 'lucide-react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { ObservedNode } from '@/lib/models';
import { getRoleLabel } from '@/lib/meshtastic';
import { cn } from '@/lib/utils';

interface NodeCardProps {
  node: ObservedNode;
}

function getBatteryColor(level: number): string {
  if (level > 60) return 'text-emerald-500';
  if (level > 20) return 'text-amber-500';
  return 'text-red-500';
}

function getBatteryBarColor(level: number): string {
  if (level > 60) return 'bg-emerald-500';
  if (level > 20) return 'bg-amber-500';
  return 'bg-red-500';
}

function BatteryIndicator({ level }: { level: number }) {
  const pct = Math.min(100, Math.max(0, level));
  return (
    <div className="flex items-center gap-2 ml-auto">
      <div className="flex items-center gap-2 w-20">
        <div className="flex-1 min-w-0 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', getBatteryBarColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{pct}%</span>
      </div>
      <Battery className={cn('h-4 w-4 shrink-0', getBatteryColor(pct))} aria-hidden />
    </div>
  );
}

export function NodeCard({ node }: NodeCardProps) {
  const batteryLevel = node.latest_device_metrics?.battery_level ?? null;
  const roleLabel = getRoleLabel(node.meshtastic_role);

  return (
    <Link
      key={node.meshtastic_node_id}
      to={`/nodes/${node.internal_id}`}
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
