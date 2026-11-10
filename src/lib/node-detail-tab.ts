export const NODE_DETAIL_TAB_IDS = ['overview', 'map', 'traceroutes', 'statistics', 'monitoring'] as const;

export type NodeDetailTab = (typeof NODE_DETAIL_TAB_IDS)[number];

const ALLOWED = new Set<string>(NODE_DETAIL_TAB_IDS);

export function isValidNodeDetailTab(value: string | null | undefined): value is NodeDetailTab {
  return value != null && ALLOWED.has(value);
}

/** Map `?tab=` query to a tab id; unknown values fall back to `overview`. */
export function parseNodeDetailTab(param: string | null): NodeDetailTab {
  if (isValidNodeDetailTab(param)) return param;
  return 'overview';
}

/** Tabs whose content follows the shared `?range=`; the shell shows the range bar only on these. */
const RANGED_TABS: ReadonlySet<NodeDetailTab> = new Set<NodeDetailTab>(['traceroutes', 'statistics']);

export function isRangedNodeDetailTab(tab: NodeDetailTab): boolean {
  return RANGED_TABS.has(tab);
}
