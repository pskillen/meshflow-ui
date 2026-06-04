import type { ResolvedHop } from '@/lib/models';
import { MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HopPositionIconProps = {
  hop?: ResolvedHop | null;
  positioned?: boolean;
  className?: string;
};

export function HopPositionIcon({ hop, positioned, className }: HopPositionIconProps) {
  const hasPosition = positioned ?? (hop?.status === 'resolved' && hop.position != null);
  const ambiguous = hop?.status === 'ambiguous' || (hop?.candidates?.length ?? 0) > 1;

  if (hasPosition) {
    return (
      <MapPin className={cn('h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400', className)} aria-hidden />
    );
  }

  return (
    <MapPinOff
      className={cn(
        'h-3.5 w-3.5 shrink-0',
        ambiguous ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        className
      )}
      aria-hidden
    />
  );
}
