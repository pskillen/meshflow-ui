import { cn } from '@/lib/utils';
import { describeBattery } from '@/lib/battery';

interface BatteryGaugeProps {
  /** Raw battery level: 0–100, or 101 when externally powered */
  batteryLevel: number | null;
  /** Voltage in volts */
  voltage: number | null;
  className?: string;
}

function getBatteryColor(level: number): string {
  if (level > 60) return 'bg-emerald-500 dark:bg-emerald-600';
  if (level > 20) return 'bg-amber-500 dark:bg-amber-600';
  return 'bg-red-500 dark:bg-red-600';
}

export function BatteryGauge({ batteryLevel, voltage, className }: BatteryGaugeProps) {
  const described = describeBattery(batteryLevel);
  const powered = described.kind === 'powered';
  const hasLevel = described.kind === 'level';
  const hasVoltage = voltage != null;
  const hasData = hasLevel || powered || hasVoltage;

  if (!hasData) {
    return (
      <div className={cn('space-y-1', className)}>
        <span className="text-sm font-medium text-muted-foreground">Battery</span>
        <div className="h-8 rounded-lg bg-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">—</span>
        </div>
      </div>
    );
  }

  const level = described.kind === 'level' ? described.pct : null;
  // Externally powered (raw 101): a full bar and the word "Powered", never "101%".
  const fillWidth = powered ? 100 : (level ?? 0);
  const fillColor = powered
    ? 'bg-emerald-500 dark:bg-emerald-600'
    : level != null
      ? getBatteryColor(level)
      : 'bg-muted-foreground/30';

  const levelText = powered ? 'Powered' : `${level ?? 0}%`;
  const label =
    hasVoltage && (hasLevel || powered)
      ? `${voltage.toFixed(2)}V / ${levelText}`
      : hasVoltage
        ? `${voltage.toFixed(2)}V`
        : levelText;

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-sm font-medium">Battery</span>
      <div className="relative h-9 rounded-lg bg-muted overflow-hidden">
        {/* Fill bar */}
        <div
          className={cn('absolute inset-y-0 left-0 rounded-lg transition-all duration-500', fillColor)}
          style={{ width: `${fillWidth}%` }}
        />
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              'text-sm font-medium tabular-nums',
              fillWidth > 45 ? 'text-white drop-shadow-sm' : 'text-foreground'
            )}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
