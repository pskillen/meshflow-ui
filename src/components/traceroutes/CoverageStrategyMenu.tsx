import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STRATEGY_META, TRACEROUTE_STRATEGIES, type TracerouteStrategyValue } from '@/lib/traceroute-strategy';

export interface CoverageStrategyMenuProps {
  /** One flag per strategy (`createCoverageStrategiesAllSelected()` shape). */
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  className?: string;
}

/** "All", "None", the one chosen label, or "n of 4". */
export function strategyMenuSummary(value: Record<string, boolean>): string {
  const selected = TRACEROUTE_STRATEGIES.filter((k) => value[k]);
  if (selected.length === TRACEROUTE_STRATEGIES.length) return 'All';
  if (selected.length === 0) return 'None';
  if (selected.length === 1) return STRATEGY_META[selected[0]].label;
  return `${selected.length} of ${TRACEROUTE_STRATEGIES.length}`;
}

/** Target selection strategies as a collapsed "Strategies: All" menu. See CoverageStrategyMenu.md. */
export function CoverageStrategyMenu({ value, onChange, className }: CoverageStrategyMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={className}
          data-testid="coverage-strategy-menu"
          aria-label="Target selection strategies"
        >
          <span className="text-muted-foreground">Strategies:</span>&nbsp;{strategyMenuSummary(value)}
          <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Target selection strategies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TRACEROUTE_STRATEGIES.map((opt: TracerouteStrategyValue) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={value[opt] ?? false}
            onCheckedChange={(c) => onChange({ ...value, [opt]: c === true })}
            onSelect={(e) => e.preventDefault()}
          >
            {STRATEGY_META[opt].label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
