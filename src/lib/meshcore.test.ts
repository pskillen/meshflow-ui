import { describe, it, expect } from 'vitest';
import { getMeshCoreAdvTypeColor, getMeshCoreAdvTypeLabel } from './meshcore';

describe('meshcore adv_type helpers', () => {
  it('returns labels for known adv types', () => {
    expect(getMeshCoreAdvTypeLabel(2)).toBe('Repeater');
    expect(getMeshCoreAdvTypeLabel(3)).toBe('Room server');
  });

  it('returns distinct colours for repeater vs chat', () => {
    expect(getMeshCoreAdvTypeColor(1)).not.toBe(getMeshCoreAdvTypeColor(2));
  });

  it('uses neutral colour when type is missing', () => {
    expect(getMeshCoreAdvTypeColor(null)).toBe('#64748b');
  });
});
