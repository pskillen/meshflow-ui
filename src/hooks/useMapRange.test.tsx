import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseSinceParam, useMapRange } from './useMapRange';

describe('parseSinceParam', () => {
  const now = new Date(Date.UTC(2026, 10, 9, 14, 37));

  it('parses YYYY-MM-DD as UTC midnight', () => {
    expect(parseSinceParam('2026-01-05', now)).toEqual(new Date(Date.UTC(2026, 0, 5)));
  });

  it('accepts today (UTC midnight is already past)', () => {
    expect(parseSinceParam('2026-11-09', now)).toEqual(new Date(Date.UTC(2026, 10, 9)));
  });

  it('rejects a future date', () => {
    expect(parseSinceParam('2026-11-10', now)).toBeNull();
    expect(parseSinceParam('2030-01-01', now)).toBeNull();
  });

  it('rejects empty, malformed and impossible dates', () => {
    expect(parseSinceParam(null, now)).toBeNull();
    expect(parseSinceParam('', now)).toBeNull();
    expect(parseSinceParam('05/01/2026', now)).toBeNull();
    expect(parseSinceParam('2026-1-5', now)).toBeNull();
    expect(parseSinceParam('2026-02-30', now)).toBeNull();
    expect(parseSinceParam('2026-13-01', now)).toBeNull();
  });
});

function setup(url: string, allowCustom: boolean) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const map = useMapRange({ allowCustom });
      return { map, search: useLocation().search };
    },
    { wrapper }
  );
}

describe('useMapRange', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('uses the preset window when there is no since', () => {
    const { result } = setup('/m', true);
    expect(result.current.map.since).toBeNull();
    expect(result.current.map.barValue).toBe('7d');
    expect(result.current.map.triggeredAtAfter).toEqual(result.current.map.range.window.start);
  });

  it('a valid since overrides the preset and deselects the bar', () => {
    const { result } = setup('/m?since=2026-01-05', true);
    expect(result.current.map.since).toEqual(new Date(Date.UTC(2026, 0, 5)));
    expect(result.current.map.triggeredAtAfter).toEqual(new Date(Date.UTC(2026, 0, 5)));
    expect(result.current.map.barValue).toBeNull();
  });

  it('ignores since when custom is not allowed, and a future or malformed since', () => {
    expect(setup('/m?since=2026-01-05', false).result.current.map.since).toBeNull();
    expect(setup('/m?since=2999-01-01', true).result.current.map.since).toBeNull();
    expect(setup('/m?since=nope', true).result.current.map.since).toBeNull();
  });

  it('choosing a preset removes since and keeps other params', () => {
    const { result } = setup('/m?since=2026-01-05&source=9', true);
    act(() => result.current.map.setPreset('30d'));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('30d');
    expect(params.has('since')).toBe(false);
    expect(params.get('source')).toBe('9');
    expect(result.current.map.barValue).toBe('30d');
  });

  it('setSince writes and clears the param', () => {
    const { result } = setup('/m?range=24h', true);
    act(() => result.current.map.setSince('2026-01-05'));
    expect(new URLSearchParams(result.current.search).get('since')).toBe('2026-01-05');
    expect(new URLSearchParams(result.current.search).get('range')).toBe('24h');
    act(() => result.current.map.setSince(null));
    expect(new URLSearchParams(result.current.search).has('since')).toBe(false);
  });
});
