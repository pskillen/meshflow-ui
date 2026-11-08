import { Badge } from '@/components/ui/badge';
import { StaleReportedTime } from '@/components/nodes/StaleReportedTime';
import { hasFirmwareBadge } from '@/lib/firmware';
import type { ManagedNode, ObservedNode } from '@/lib/models';

/** The lowest generation the API reports; it means "this or earlier". Every other value reads `<value>+`. */
const LOWEST_GENERATION = '2.7';

type FirmwareNode = Pick<ObservedNode, 'protocol' | 'inferred_firmware' | 'inferred_firmware_basis'>;

function firmwareLabel(node: FirmwareNode): string {
  const generation = node.inferred_firmware;
  if (!generation) return 'Unknown';
  // Only a feeder report reads "reported"; every other basis is an inference.
  const reported = node.inferred_firmware_basis === 'feeder_report';
  if (generation === LOWEST_GENERATION)
    return reported ? `${generation} (reported)` : `${generation} or earlier (inferred)`;
  return `${generation}+ (${reported ? 'reported' : 'inferred'})`;
}

export function FirmwareBadge({ node }: { node: FirmwareNode }) {
  if (!hasFirmwareBadge(node)) return null;
  return (
    <Badge variant="outline" className="text-xs font-normal">
      {firmwareLabel(node)}
    </Badge>
  );
}

export function FeederFirmware({
  node,
}: {
  node: Pick<ManagedNode, 'reported_firmware_version' | 'firmware_reported_at'>;
}) {
  if (!node.reported_firmware_version) return <>—</>;
  const reportedAt = node.firmware_reported_at ? new Date(node.firmware_reported_at) : null;
  return (
    <div className="flex flex-col">
      <span>{node.reported_firmware_version}</span>
      {reportedAt ? (
        <StaleReportedTime at={reportedAt} className="text-xs text-muted-foreground" variant="neutral" />
      ) : null}
    </div>
  );
}
