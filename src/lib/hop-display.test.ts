import { describe, it, expect } from 'vitest';
import { describeHops } from './hop-display';

describe('describeHops', () => {
  it('direct', () => {
    expect(describeHops({ direct_from_sender: true, hop_count: 0 }).label).toBe('Direct');
  });
  it('known hop count, also from an older payload without the new fields', () => {
    expect(describeHops({ direct_from_sender: false, hop_count: 3 }).label).toBe('Hops: 3');
  });
  it('unknown hop count', () => {
    expect(describeHops({ direct_from_sender: false, hop_count: null }).label).toBe('Hops unknown');
    expect(
      describeHops({ direct_from_sender: false, hop_count: null, transport_mechanism: 'TRANSPORT_LORA' }).label
    ).toBe('Hops unknown');
    expect(describeHops({ direct_from_sender: false, hop_count: null, via_mqtt: false }).label).toBe('Hops unknown');
  });
  it('via internet by flag or transport', () => {
    expect(describeHops({ direct_from_sender: false, hop_count: null, via_mqtt: true }).label).toBe('Via internet');
    expect(
      describeHops({ direct_from_sender: false, hop_count: null, transport_mechanism: 'TRANSPORT_MULTICAST_UDP' }).label
    ).toBe('Via internet');
  });
  it('replayed', () => {
    const d = describeHops({ direct_from_sender: false, hop_count: null, replayed: true });
    expect(d.label).toBe('Replayed by the feeder');
    expect(d.explanation).not.toBe('');
  });
});
