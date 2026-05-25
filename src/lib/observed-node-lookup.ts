import type { MeshProtocol, ObservedNode } from '@/lib/models';

export type ObservedNodeLookupChoice = {
  internal_id: string;
  protocol: MeshProtocol;
  node_id_str: string;
  short_name: string;
  long_name: string;
};

export type ObservedNodeLookupAmbiguous = {
  detail: string;
  choices: ObservedNodeLookupChoice[];
};

export type ResolveObservedNodeResult =
  | { status: 'ok'; node: ObservedNode }
  | { status: 'ambiguous'; ambiguous: ObservedNodeLookupAmbiguous };

export function isObservedNodeLookupAmbiguous(
  value: ResolveObservedNodeResult
): value is { status: 'ambiguous'; ambiguous: ObservedNodeLookupAmbiguous } {
  return value.status === 'ambiguous';
}
