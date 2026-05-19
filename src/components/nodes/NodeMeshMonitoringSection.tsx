import { useState } from 'react';
import { MeshWatchControls } from '@/components/nodes/MeshWatchControls';
import { NodeMeshMonitoringSettingsDialog } from '@/components/nodes/NodeMeshMonitoringSettingsDialog';
import { useNodeMonitoringConfig, useNodeWatches } from '@/hooks/api/useNodeWatches';
import type { ObservedNode } from '@/lib/models';
import { authService } from '@/lib/auth/authService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Settings } from 'lucide-react';
import { formatUptimeSeconds } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function NodeMeshMonitoringSection({ node }: { node: ObservedNode }) {
  const currentUser = authService.getCurrentUser();
  const watchesQuery = useNodeWatches();
  const observedUuid = String(node.internal_id);
  const configQuery = useNodeMonitoringConfig(observedUuid, Boolean(currentUser));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const watch = watchesQuery.data?.results.find((w) => w.observed_node.node_id_str === node.node_id_str);

  if (!currentUser) {
    return null;
  }

  const silenceSeconds = configQuery.data?.last_heard_offline_after_seconds;
  const canEditConfig = configQuery.data?.editable ?? false;

  return (
    <div className="mb-6">
      <Card>
        <CardHeader className="space-y-0">
          <div className="flex flex-row items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle>Mesh monitoring</CardTitle>
              <CardDescription>
                Watch this node for silence / offline verification and optional low-battery episodes. Discord uses your
                linked account; choose which notification channels apply to this watch below.
              </CardDescription>
            </div>
            {canEditConfig && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Mesh monitoring settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Your watch</h3>
            <MeshWatchControls
              node={node}
              watch={watch}
              watchesQuery={watchesQuery}
              idPrefix={`detail-${node.meshtastic_node_id}`}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Offline monitoring</h3>
            <p className="text-sm text-muted-foreground">
              When the node is quiet longer than the silence threshold, monitoring may run a verification traceroute
              round and confirm offline if the mesh still cannot reach it.
            </p>
            {configQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading threshold…
              </div>
            )}
            {configQuery.isError && <p className="text-sm text-muted-foreground">Could not load silence threshold.</p>}
            {!configQuery.isLoading && !configQuery.isError && silenceSeconds != null && (
              <p className="text-sm text-muted-foreground">
                Current silence before verification:{' '}
                <span className="text-foreground font-medium">{formatUptimeSeconds(silenceSeconds)}</span>.
                {canEditConfig ? ' Use the settings button above to change it.' : ''}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Battery monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Optional per-node rules for low-battery episodes (consecutive below-threshold telemetry). When enabled and
              confirmed, watchers who opt into battery Discord notifications can be DM’d once per episode.
            </p>
            {configQuery.isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading battery rules…
              </div>
            )}
            {configQuery.isError && <p className="text-sm text-muted-foreground">Could not load battery settings.</p>}
            {!configQuery.isLoading && !configQuery.isError && configQuery.data && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={configQuery.data.battery_alert_enabled ? 'secondary' : 'outline'}>
                  {configQuery.data.battery_alert_enabled ? 'Battery rules on' : 'Battery rules off'}
                </Badge>
                {configQuery.data.battery_alert_enabled ? (
                  <>
                    <span className="text-muted-foreground">
                      Threshold {configQuery.data.battery_alert_threshold_percent}%, streak{' '}
                      {configQuery.data.battery_alert_report_count} reports
                    </span>
                    {configQuery.data.battery_alert_active ? (
                      <Badge variant="destructive" className="text-xs">
                        Active alert
                      </Badge>
                    ) : null}
                  </>
                ) : null}
                {canEditConfig ? (
                  <span className="text-muted-foreground">— edit in settings</span>
                ) : (
                  <span className="text-muted-foreground">— only claim owner or staff can edit rules</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <NodeMeshMonitoringSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        observedNodeId={observedUuid}
        nodeId={node.meshtastic_node_id}
      />
    </div>
  );
}
