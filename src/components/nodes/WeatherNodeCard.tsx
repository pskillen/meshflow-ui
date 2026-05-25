import { Link } from 'react-router-dom';
import { EnvironmentMetrics, ObservedNode } from '@/lib/models';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { EnvironmentMetricsMiniChart } from './EnvironmentMetricsMiniChart';
import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { observedNodeDetailPath } from '@/lib/node-detail-routes';

interface WeatherNodeCardProps {
  node: ObservedNode;
  /** Environment metrics history for mini chart */
  metrics?: EnvironmentMetrics[];
  dateRange?: { startDate: Date; endDate: Date };
}

function WeatherNodeCardInner({ node, metrics, dateRange }: WeatherNodeCardProps) {
  const env = node.latest_environment_metrics;
  const envReportedTime = env?.reported_time ? new Date(env.reported_time) : null;

  return (
    <div className="flex flex-col h-full p-6 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-slate-200 dark:border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{node.short_name}</h2>
          <p className="text-slate-600 dark:text-slate-400">{node.long_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {envReportedTime ? <StaleReportedTime at={envReportedTime} className="text-inherit" /> : 'No env data'}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-slate-600 dark:text-slate-400">ID: {node.node_id_str}</p>
        {node.owner && <p className="text-slate-600 dark:text-slate-400">Owner: {node.owner.username}</p>}
        {env && (
          <div className="flex flex-wrap gap-3 text-sm">
            {env.temperature != null && <span>Temp: {env.temperature.toFixed(1)}°C</span>}
            {env.barometric_pressure != null && <span>Pressure: {Math.round(env.barometric_pressure)} hPa</span>}
            {env.relative_humidity != null && <span>RH: {Math.round(env.relative_humidity)}%</span>}
            {env.iaq != null && <span>IAQ: {env.iaq}</span>}
            {env.lux != null && <span>Lux: {env.lux.toFixed(0)} lx</span>}
          </div>
        )}
        {metrics != null && metrics.length > 0 && dateRange && (
          <div className="mt-3 -mx-2">
            <EnvironmentMetricsMiniChart metrics={metrics} dateRange={dateRange} />
          </div>
        )}
      </div>
      <div className="mt-auto flex justify-end pt-3">
        <Link
          to={observedNodeDetailPath(node) ?? '#'}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open node details
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export const WeatherNodeCard = memo(WeatherNodeCardInner);
