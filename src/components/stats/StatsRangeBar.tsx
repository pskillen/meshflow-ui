import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { STATS_RANGES, type StatsRangeKey } from '@/lib/stats-range';

export interface StatsRangeBarProps {
  /** Currently selected range (`useStatsRange().key`). `null` while a screen's custom range is active: no preset is selected. */
  value: StatsRangeKey | null;
  /** Ranges to offer, in order (`useStatsRange().options`). Online (2h) shows only if it is in here. */
  options: readonly StatsRangeKey[];
  onChange: (key: StatsRangeKey) => void;
  /** Optional page title shown at the start of the bar. */
  title?: ReactNode;
  /** Screen extras (feeder filter, custom range, snapshot time) placed before the range control. */
  children?: ReactNode;
  /** Stick to the top of the scroll area. Default true. */
  sticky?: boolean;
  className?: string;
}

/** The one time-range control. See StatsRangeBar.md. */
export function StatsRangeBar({
  value,
  options,
  onChange,
  title,
  children,
  sticky = true,
  className,
}: StatsRangeBarProps) {
  const buttons = useRef(new Map<StatsRangeKey, HTMLButtonElement>());

  // Radio-group keyboard model: one tab stop (the selected radio), arrows move and select, Home/End jump.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.indexOf(value);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const key = options[next];
    if (key === undefined) return;
    onChange(key);
    buttons.current.get(key)?.focus();
  }

  return (
    <div
      data-testid="stats-range-bar"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/95 py-2.5 backdrop-blur',
        sticky && 'sticky top-0 z-30',
        className
      )}
    >
      {title ? <div className="mr-auto min-w-0 text-lg font-semibold">{title}</div> : null}
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      <div
        role="radiogroup"
        aria-label="Time range"
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex max-w-full overflow-x-auto rounded-md border bg-muted/40 p-0.5',
          !title && !children && 'ml-auto'
        )}
      >
        {options.map((key) => {
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                if (el) buttons.current.set(key, el);
                else buttons.current.delete(key);
              }}
              onClick={() => onChange(key)}
              className={cn(
                'h-8 whitespace-nowrap rounded px-3 text-sm md:h-7 md:px-3',
                selected ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {STATS_RANGES[key].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
