import { describe, expect, it } from 'vitest';
import { STATS_RANGES, statsRangeWindow } from '@/lib/stats-range';
import { bestEdgeSnr, bucketLinkSnr, countOffScale, meanOfDrawn, peerLabel, sortLinksByActivity } from './node-traceroute-snr';

const NOW = new Date('2026-11-10T09:37:00Z');
const window7d = statsRangeWindow('7d', NOW);
const bucket = STATS_RANGES['7d'].bucket;

describe('bucketLinkSnr', () => {
  it('averages samples per UTC bucket, per direction, and leaves empty buckets out', () => {
    const rows = bucketLinkSnr(
      {
        inbound: [
          { triggered_at: '2026-11-09T00:10:00Z', snr: -4 },
          { triggered_at: '2026-11-09T01:50:00Z', snr: -8 },
          { triggered_at: '2026-11-09T07:00:00Z', snr: 2 },
        ],
        outbound: [{ triggered_at: '2026-11-09T00:30:00Z', snr: 5 }],
      },
      window7d,
      bucket
    );
    expect(rows).toEqual([
      { timestamp: Date.parse('2026-11-09T00:00:00Z'), inbound: -6, outbound: 5 },
      { timestamp: Date.parse('2026-11-09T06:00:00Z'), inbound: 2 },
    ]);
  });

  it('ignores samples outside the window and bad values', () => {
    const rows = bucketLinkSnr(
      {
        inbound: [
          { triggered_at: '2026-10-01T00:00:00Z', snr: -4 },
          { triggered_at: '2026-11-10T09:00:00Z', snr: 1 },
          { triggered_at: '2026-11-10T12:00:00Z', snr: 3 },
          { triggered_at: 'nope', snr: 3 },
        ],
        outbound: [],
      },
      window7d,
      bucket
    );
    expect(rows).toEqual([{ timestamp: Date.parse('2026-11-10T06:00:00Z'), inbound: 1 }]);
  });

  it('counts a sample in the bucket in progress when one is drawn (7d, mid-bucket)', () => {
    const rows = bucketLinkSnr(
      { inbound: [{ triggered_at: '2026-11-10T09:20:00Z', snr: 1 }], outbound: [] },
      window7d,
      bucket
    );
    expect(rows).toEqual([{ timestamp: Date.parse('2026-11-10T06:00:00Z'), inbound: 1 }]);
  });

  it('drops a sample after the top of the hour on 24h, which is off the chart grid', () => {
    const w24 = statsRangeWindow('24h', NOW);
    expect(w24.partialEnd).toBe(false);
    const rows = bucketLinkSnr(
      {
        inbound: [
          { triggered_at: '2026-11-10T08:30:00Z', snr: -3 },
          { triggered_at: '2026-11-10T09:20:00Z', snr: 9 },
        ],
        outbound: [],
      },
      w24,
      STATS_RANGES['24h'].bucket
    );
    expect(rows).toEqual([{ timestamp: Date.parse('2026-11-10T08:00:00Z'), inbound: -3 }]);
  });

  it('drops samples in the first hour of a 6h bucket (12:20 UTC, 7d), which are off the grid', () => {
    const w = statsRangeWindow('7d', new Date('2026-11-10T12:20:00Z'));
    expect(w.partialEnd).toBe(false);
    const rows = bucketLinkSnr(
      { inbound: [{ triggered_at: '2026-11-10T12:10:00Z', snr: 2 }], outbound: [] },
      w,
      bucket
    );
    expect(rows).toEqual([]);
  });
});

describe('countOffScale', () => {
  it('counts drawn values outside the range, in either direction', () => {
    const rows = [{ a: 15, b: -30 }, { a: 0 }, { a: 10, b: -20 }, {}];
    expect(countOffScale(rows, ['a', 'b'], [-20, 10])).toBe(2);
  });
});

describe('meanOfDrawn', () => {
  it('is the mean of the drawn values, or null with none', () => {
    expect(meanOfDrawn([{ a: 2 }, { a: 4 }, {}], 'a')).toBe(3);
    expect(meanOfDrawn([{}], 'a')).toBeNull();
  });
});

describe('bestEdgeSnr', () => {
  it('takes the best average in either direction, skipping nulls', () => {
    expect(
      bestEdgeSnr([
        { avg_snr_in: -3, avg_snr_out: null },
        { avg_snr_in: null, avg_snr_out: 4.25 },
      ])
    ).toBe(4.25);
    expect(bestEdgeSnr([{ avg_snr_in: null, avg_snr_out: null }])).toBeNull();
    expect(bestEdgeSnr([])).toBeNull();
  });
});

describe('peerLabel and sortLinksByActivity', () => {
  const link = (id: number, name: string, ts: string[]) => ({
    peer_node_id: id,
    peer_short_name: name,
    inbound: ts.map((t) => ({ triggered_at: t, snr: 0 })),
    outbound: [],
  });

  it('falls back to the hex id', () => {
    expect(peerLabel({ peer_node_id: 255, peer_short_name: '' })).toBe('!ff');
  });

  it('puts the most-traced link first, then the most recent', () => {
    const sorted = sortLinksByActivity([
      link(1, 'A', ['2026-11-01T00:00:00Z']),
      link(2, 'B', ['2026-11-02T00:00:00Z', '2026-11-02T01:00:00Z']),
      link(3, 'C', ['2026-11-05T00:00:00Z']),
    ]);
    expect(sorted.map((l) => l.peer_short_name)).toEqual(['B', 'C', 'A']);
  });
});
