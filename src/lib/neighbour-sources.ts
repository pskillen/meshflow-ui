import type { NeighbourStatsBySource } from '@/lib/models';

/** How many sources "Heard most from" draws; the rest are summed in a line under the list. */
export const NEIGHBOUR_BARS_SHOWN = 10;

export function neighbourSourceLabel(item: NeighbourStatsBySource): string {
  const first = item.candidates[0];
  if (item.source_type === 'full' && first) return first.short_name || first.node_id_str;
  if (item.source_type === 'lsb') {
    if (item.candidates.length === 1 && first) return first.short_name || first.node_id_str;
    return `LSB ${item.source}`;
  }
  return first?.node_id_str ?? `Source ${item.source}`;
}
