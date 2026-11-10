import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatsRangeBar } from '@/components/stats/StatsRangeBar';
import type { StatsRange } from '@/hooks/useStatsRange';
import type { NodeDetailTab } from '@/lib/node-detail-tab';

export interface NodeShellTab {
  value: NodeDetailTab;
  label: string;
}

export interface NodeShellProps {
  shortName: string | null;
  longName?: string | null;
  /** Hardware model chip; hidden on phones. */
  hardware?: string | null;
  /** Claim badge and button, beside the name. */
  actions?: ReactNode;
  tabs: readonly NodeShellTab[];
  activeTab: NodeDetailTab;
  onTabChange: (tab: NodeDetailTab) => void;
  /** Pass the page's range to show the range bar (ranged tabs only); omit or null to hide it. */
  range?: StatsRange | null;
  /** Where the back arrow goes. */
  backTo?: string;
  /** The active tab's content. */
  children: ReactNode;
}

/**
 * Compact sticky header for a full node page: back arrow, name, hardware, tabs and, on ranged tabs, the shared range
 * bar. Renders the tab content under it. See NodeShell.md.
 */
export function NodeShell({
  shortName,
  longName,
  hardware,
  actions,
  tabs,
  activeTab,
  onTabChange,
  range,
  backTo = '/nodes',
  children,
}: NodeShellProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as NodeDetailTab)} data-testid="node-detail-tabs">
      <div
        className="sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/95 px-4 pt-2.5 backdrop-blur"
        data-testid="node-shell-header"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
          <Link
            to={backTo}
            replace={true}
            aria-label="Back to Nodes"
            className="text-teal-600 hover:underline dark:text-teal-400"
          >
            ←
          </Link>
          <h1 className="text-lg font-semibold">{shortName ?? '—'}</h1>
          {longName ? (
            <span className="max-w-[180px] truncate text-sm text-muted-foreground md:max-w-none">{longName}</span>
          ) : null}
          {hardware ? (
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground md:inline-flex">
              {hardware}
            </span>
          ) : null}
          {actions}
          {range ? (
            <StatsRangeBar
              value={range.key}
              options={range.options}
              onChange={range.setRange}
              sticky={false}
              className="ml-auto border-0 bg-transparent py-0 backdrop-blur-none"
            />
          ) : null}
        </div>
        <TabsList className="-mb-px flex h-auto w-full justify-start gap-4 overflow-x-auto rounded-none bg-transparent p-0">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              data-testid={`node-detail-tab-${t.value}`}
              className="whitespace-nowrap rounded-none border-b-2 border-transparent px-0 pb-2 pt-0 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
