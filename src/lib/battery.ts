/** Meshtastic reports battery_level 101 when the node is externally powered. */
export const POWERED_BATTERY_LEVEL = 101;

export type BatteryDisplay =
  { kind: 'none' } | { kind: 'powered' } | { kind: 'level'; pct: number; tone: 'good' | 'warn' | 'low' };

export function batteryTone(pct: number): 'good' | 'warn' | 'low' {
  if (pct > 60) return 'good';
  if (pct > 20) return 'warn';
  return 'low';
}

/**
 * Interpret a raw device-metrics battery_level.
 * null/undefined/NaN and negatives are "no data" (the device never reports a negative level); 0 is a real
 * reading; 101 (or more) is "Powered"; else round, then clamp to 0-100 (so 100.5 reads 100%, not 101%).
 */
export function describeBattery(raw: number | null | undefined): BatteryDisplay {
  if (raw == null || Number.isNaN(raw)) return { kind: 'none' };
  if (raw < 0) return { kind: 'none' };
  if (raw >= POWERED_BATTERY_LEVEL) return { kind: 'powered' };
  const pct = Math.min(100, Math.round(raw));
  return { kind: 'level', pct, tone: batteryTone(pct) };
}

/** Short text for a raw level: "Powered", "87%", or "—". */
export function formatBattery(raw: number | null | undefined): string {
  const d = describeBattery(raw);
  if (d.kind === 'none') return '—';
  if (d.kind === 'powered') return 'Powered';
  return `${d.pct}%`;
}
