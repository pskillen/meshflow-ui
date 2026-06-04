import { MeshCoreHeardPathFlow } from './MeshCoreHeardPathFlow';
import type { MeshCoreHeardLeg } from './heard-path-map-adapters';

export type MeshCoreHeardPathsPanelProps = {
  legs: MeshCoreHeardLeg[];
  senderDisplayLabel: string;
  senderKnown: boolean;
  senderHasPosition?: boolean;
  senderDetailPath?: string | null;
  hasAmbiguousHops?: boolean;
};

export function MeshCoreHeardPathsPanel({
  legs,
  senderDisplayLabel,
  senderKnown,
  senderHasPosition = false,
  senderDetailPath = null,
  hasAmbiguousHops = false,
}: MeshCoreHeardPathsPanelProps) {
  if (legs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-4">
        No feeder observations for this message.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="meshcore-heard-paths-panel">
      {hasAmbiguousHops && (
        <p
          className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-500/50 bg-amber-50/90 dark:bg-amber-950/50 px-3 py-2"
          role="status"
        >
          Some path hops match multiple nodes. Those hops are listed below but omitted from the map.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Paths are per feeder and may differ for the same message. Hop hashes are list-order evidence, not map
        coordinates.
      </p>
      {legs.map((leg) => (
        <div
          key={`${leg.observation.observer.node_id_str}-${leg.observation.rx_time}`}
          className="rounded-md border px-3 py-3 space-y-2"
          style={{ borderLeftWidth: 4, borderLeftColor: leg.lineColor }}
        >
          <div className="text-xs font-medium text-muted-foreground">Heard by {leg.receiverLabel}</div>
          <MeshCoreHeardPathFlow
            leg={leg}
            senderDisplayLabel={senderDisplayLabel}
            senderKnown={senderKnown}
            senderHasPosition={senderHasPosition}
            senderDetailPath={senderDetailPath}
          />
        </div>
      ))}
    </div>
  );
}
