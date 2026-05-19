import { Link } from 'react-router-dom';
import {
  MoreVertical,
  Radio,
  Settings,
  ChevronRight,
  FileText,
  AlertTriangle,
  AlertCircle,
  UserX,
  Unplug,
} from 'lucide-react';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import type { UseQueryResult } from '@tanstack/react-query';

import { MeshWatchControls } from '@/components/nodes/MeshWatchControls';
import { BatteryGauge } from '@/components/nodes/BatteryGauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ObservedNode, NodeWatch, PaginatedResponse } from '@/lib/models';
import { cn } from '@/lib/utils';
import type { ManagedLiveness, PositionHintTreatment } from '@/lib/my-nodes-grouping';
import { getPositionHint } from '@/lib/my-nodes-grouping';

function positionTreatmentBadgeClass(t: PositionHintTreatment): string | undefined {
  if (t === 'stale') {
    return 'border-amber-500/70 bg-amber-50/90 text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/35 dark:text-amber-50';
  }
  if (t === 'missing') {
    return 'border-destructive/60 bg-destructive/10 text-destructive font-medium dark:border-destructive/50 dark:bg-destructive/15 dark:text-destructive';
  }
  return undefined;
}

export interface MyNodeCardProps {
  node: ObservedNode;
  isManaged: boolean;
  isClaimed: boolean;
  /** When false, hides the Claimed badge (e.g. on My Nodes where every card is the user’s). Default true. */
  showClaimedBadge?: boolean;
  /** When set and not `ok`, shows a prominent liveness warning (managed nodes on My Nodes). */
  managedLiveness?: Pick<ManagedLiveness, 'severity' | 'message'> | null;
  watch: NodeWatch | undefined;
  watchesQuery: Pick<UseQueryResult<PaginatedResponse<NodeWatch>>, 'isLoading' | 'isError'>;
  onConvert: () => void;
  onShowSetupInstructions: () => void;
  /** When set, shows “Unclaim node” (claimed-only rows). */
  onRequestUnclaim?: () => void;
  /** When set, shows “Unmanage node” (managed rows). */
  onRequestUnmanage?: () => void;
}

export function MyNodeCard({
  node,
  isManaged,
  isClaimed,
  showClaimedBadge = true,
  managedLiveness = null,
  watch,
  watchesQuery,
  onConvert,
  onShowSetupInstructions,
  onRequestUnclaim,
  onRequestUnmanage,
}: MyNodeCardProps) {
  const metrics = node.latest_device_metrics;
  const batteryLevel = metrics?.battery_level != null ? metrics.battery_level : null;
  const voltage = metrics?.voltage != null ? metrics.voltage : null;
  const metricsReported = metrics?.reported_time ? new Date(metrics.reported_time) : null;
  const positionHint = getPositionHint(node);
  const positionBadgeClass = positionTreatmentBadgeClass(positionHint.treatment);
  const displayName = node.short_name || node.node_id_str;
  const liveness =
    managedLiveness != null && managedLiveness.severity !== 'ok' && managedLiveness.message != null
      ? managedLiveness
      : null;

  return (
    <Card className="min-w-0 flex flex-col h-full border bg-card shadow-sm dark:border-border/80 dark:border-2 dark:shadow-md">
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight truncate">{displayName}</h2>
            {node.long_name ? <p className="text-sm text-muted-foreground truncate mt-0.5">{node.long_name}</p> : null}
            <p className="text-xs font-mono text-muted-foreground mt-1 truncate">{node.node_id_str}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`More actions for ${displayName}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {!isManaged ? (
                <DropdownMenuItem onSelect={() => onConvert()}>
                  <Radio className="mr-2 h-4 w-4" />
                  Convert to managed
                </DropdownMenuItem>
              ) : null}
              {isManaged ? (
                <DropdownMenuItem onSelect={() => onShowSetupInstructions()}>
                  <FileText className="mr-2 h-4 w-4" />
                  Setup instructions
                </DropdownMenuItem>
              ) : null}
              {onRequestUnmanage != null && isManaged ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onRequestUnmanage()}
                >
                  <Unplug className="mr-2 h-4 w-4" />
                  Unmanage node
                </DropdownMenuItem>
              ) : null}
              {onRequestUnclaim != null && isClaimed && !isManaged ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onRequestUnclaim()}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Unclaim node
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {liveness ? (
          <Alert
            variant={liveness.severity === 'destructive' ? 'destructive' : 'default'}
            className={
              liveness.severity === 'destructive'
                ? undefined
                : 'border-amber-500/70 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/35 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-400'
            }
          >
            {liveness.severity === 'destructive' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle className="leading-snug">
              {liveness.severity === 'destructive' ? 'Connectivity issue' : 'Attention'}
            </AlertTitle>
            <AlertDescription>{liveness.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {isManaged ? (
            <Badge variant="outline" className="text-xs">
              Managed
            </Badge>
          ) : null}
          {isClaimed && showClaimedBadge ? (
            <Badge variant="outline" className="text-xs">
              Claimed
            </Badge>
          ) : null}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex max-w-full">
                  <Badge
                    variant={positionHint.treatment === 'missing' ? 'outline' : 'secondary'}
                    className={cn('text-xs cursor-default', positionBadgeClass)}
                  >
                    {positionHint.label}
                  </Badge>
                </span>
              </TooltipTrigger>
              {positionHint.tooltip ? (
                <TooltipContent side="bottom" className="max-w-xs">
                  {positionHint.tooltip}
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">
          Last heard{' '}
          <StaleReportedTime at={node.last_heard ?? null} fallback="never" className="text-foreground tabular-nums" />
        </p>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-default">
                <BatteryGauge batteryLevel={batteryLevel} voltage={voltage} />
              </div>
            </TooltipTrigger>
            {metricsReported ? (
              <TooltipContent side="bottom" className="max-w-xs">
                Metrics updated <StaleReportedTime at={metricsReported} className="inline" />
              </TooltipContent>
            ) : (
              <TooltipContent side="bottom">No recent telemetry timestamp</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t pt-4 mt-auto">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Mesh monitoring</p>
          <MeshWatchControls
            node={node}
            watch={watch}
            watchesQuery={watchesQuery}
            idPrefix={`my-nodes-card-${node.meshtastic_node_id}`}
            compact
          />
        </div>
        <Button asChild className="w-full">
          <Link to={`/nodes/${node.meshtastic_node_id}`} className="inline-flex items-center justify-center gap-1.5">
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            Node details
            <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
