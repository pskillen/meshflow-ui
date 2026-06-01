import { MeshCoreHeardPathFlow } from './MeshCoreHeardPathFlow';
import type { MeshCoreHeardLeg } from './heard-path-map-adapters';

export type MeshCoreHeardPathsPanelProps = {
  legs: MeshCoreHeardLeg[];
  senderDisplayLabel: string;
  senderKnown: boolean;
};

export function MeshCoreHeardPathsPanel({ legs, senderDisplayLabel, senderKnown }: MeshCoreHeardPathsPanelProps) {
  if (legs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-4">
        No feeder observations for this message.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="meshcore-heard-paths-panel">
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
          <MeshCoreHeardPathFlow leg={leg} senderDisplayLabel={senderDisplayLabel} senderKnown={senderKnown} />
        </div>
      ))}
    </div>
  );
}
