import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStatsRange, type UseStatsRangeOptions } from './useStatsRange';

const NOW = new Date(Date.UTC(2026, 10, 9, 14, 37, 12));

function setup(initialUrl: string, opts: UseStatsRangeOptions = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const range = useStatsRange({ now: () => NOW, ...opts });
      const location = useLocation();
      return { range, search: location.search };
    },
    { wrapper }
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useStatsRange', () => {
  it('defaults to 7d with a 6-hour bucket', () => {
    const { result } = setup('/x');
    expect(result.current.range.key).toBe('7d');
    expect(result.current.range.bucket).toBe('6h');
    expect(result.current.range.window.end).toEqual(new Date(Date.UTC(2026, 10, 9, 14, 0, 0)));
  });

  it('URL wins over remembered area value', () => {
    window.sessionStorage.setItem('meshflow.statsRange.dash', '90d');
    const { result } = setup('/x?range=24h', { area: 'dash' });
    expect(result.current.range.key).toBe('24h');
  });

  it('falls back to 7d for an invalid or disallowed URL value', () => {
    expect(setup('/x?range=banana').result.current.range.key).toBe('7d');
    expect(setup('/x?range=all').result.current.range.key).toBe('7d');
    // 2h is not allowed unless the screen opts in
    expect(setup('/x?range=2h').result.current.range.key).toBe('7d');
    expect(setup('/x?range=2h', { options: ['2h', '24h', '7d'] }).result.current.range.key).toBe('2h');
  });

  it('resolution order is URL > area memory > default, and an invalid URL value falls through to memory', () => {
    window.sessionStorage.setItem('meshflow.statsRange.dash', '90d');
    expect(setup('/x', { area: 'dash' }).result.current.range.key).toBe('90d');
    expect(setup('/x?range=banana', { area: 'dash' }).result.current.range.key).toBe('90d');
    expect(setup('/x?range=banana', { area: 'other' }).result.current.range.key).toBe('7d');
    // a valid URL value beats the memory (and replaces it)
    expect(setup('/x?range=24h', { area: 'dash' }).result.current.range.key).toBe('24h');
  });

  it('rewrites an invalid ?range= to the range in effect, keeping other params', () => {
    const bad = setup('/x?tab=packets&range=banana');
    expect(bad.result.current.search).toBe('?tab=packets&range=7d');
    window.sessionStorage.setItem('meshflow.statsRange.dash', '30d');
    expect(setup('/x?range=all', { area: 'dash' }).result.current.search).toBe('?range=30d');
    expect(setup('/x?range=2h').result.current.search).toBe('?range=7d');
  });

  it('leaves the URL alone when ?range= is valid or absent, and in local mode', () => {
    expect(setup('/x?range=24h&tab=a').result.current.search).toBe('?range=24h&tab=a');
    expect(setup('/x').result.current.search).toBe('');
    expect(setup('/x?range=banana', { local: true }).result.current.search).toBe('?range=banana');
  });

  it('uses the first allowed option when 7d is not allowed', () => {
    const { result } = setup('/x', { options: ['24h', '30d'] });
    expect(result.current.range.key).toBe('24h');
  });

  it('setRange writes with replace and keeps other params', () => {
    const { result } = setup('/x?tab=packets&source_node=12');
    act(() => result.current.range.setRange('30d'));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('30d');
    expect(params.get('tab')).toBe('packets');
    expect(params.get('source_node')).toBe('12');
    expect(result.current.range.key).toBe('30d');
  });

  it('ignores setRange for a key the screen does not allow', () => {
    const { result } = setup('/x');
    act(() => result.current.range.setRange('2h'));
    expect(result.current.search).toBe('');
  });

  it('remembers the range per area when the URL has none', () => {
    const first = setup('/a', { area: 'dash' });
    act(() => first.result.current.range.setRange('30d'));
    // a different screen in the same area, reached with no ?range=
    expect(setup('/b', { area: 'dash' }).result.current.range.key).toBe('30d');
    // a different area does not inherit
    expect(setup('/b', { area: 'traceroutes' }).result.current.range.key).toBe('7d');
  });

  it('a range arriving by URL is remembered for the area', () => {
    setup('/a?range=90d', { area: 'dash' });
    expect(setup('/b', { area: 'dash' }).result.current.range.key).toBe('90d');
  });

  it('does not remember or inherit without an area (node pages)', () => {
    const first = setup('/a');
    act(() => first.result.current.range.setRange('24h'));
    expect(setup('/b').result.current.range.key).toBe('7d');
  });

  it('ignores a remembered value the screen does not allow', () => {
    window.sessionStorage.setItem('meshflow.statsRange.dash', '2h');
    expect(setup('/a', { area: 'dash' }).result.current.range.key).toBe('7d');
  });

  it('still works when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = setup('/a', { area: 'dash' });
    expect(result.current.range.key).toBe('7d');
    act(() => result.current.range.setRange('24h'));
    expect(result.current.range.key).toBe('24h');
    expect(new URLSearchParams(result.current.search).get('range')).toBe('24h');
  });

  it('local mode holds state without touching the URL or memory', () => {
    const { result } = setup('/host?range=90d&tab=x', { area: 'dash', local: true });
    expect(result.current.range.key).toBe('7d'); // host page's ?range= is ignored
    act(() => result.current.range.setRange('24h'));
    expect(result.current.range.key).toBe('24h');
    expect(result.current.search).toBe('?range=90d&tab=x');
    expect(window.sessionStorage.getItem('meshflow.statsRange.dash')).toBeNull();
  });

  it('keeps the same window object across renders within the hour', () => {
    const { result, rerender } = setup('/x');
    const first = result.current.range.window;
    rerender();
    expect(result.current.range.window).toBe(first);
  });

  it('returns the same object across renders until something changes', () => {
    const { result, rerender } = setup('/x');
    const first = result.current.range;
    rerender();
    expect(result.current.range).toBe(first);
    act(() => result.current.range.setRange('30d'));
    expect(result.current.range).not.toBe(first);
  });

  it('Online (2h) window ends at now', () => {
    const { result } = setup('/x?range=2h', { options: ['2h', '24h', '7d'] });
    expect(result.current.range.window.end).toEqual(new Date(Date.UTC(2026, 10, 9, 14, 35)));
  });

  it('clearOnChange: choosing a range drops the named params and keeps the rest', () => {
    const clear = ['since'] as const;
    const { result } = setup('/x?since=2026-01-05&source=9&range=24h', { clearOnChange: clear });
    act(() => result.current.range.setRange('30d'));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('30d');
    expect(params.has('since')).toBe(false);
    expect(params.get('source')).toBe('9');
  });

  it('without clearOnChange every other param survives a range change', () => {
    const { result } = setup('/x?since=2026-01-05');
    act(() => result.current.range.setRange('30d'));
    expect(new URLSearchParams(result.current.search).get('since')).toBe('2026-01-05');
  });
});
