import { describe, it, expect, afterEach } from 'vitest';
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { useNodeDetailPageTabs } from '@/pages/nodes/useNodeDetailPageTabs';
import { useStatsRange } from '@/hooks/useStatsRange';

let tabs: ReturnType<typeof useNodeDetailPageTabs>;
let range: ReturnType<typeof useStatsRange>;

function Probe() {
  const t = useNodeDetailPageTabs();
  const r = useStatsRange();
  useEffect(() => {
    tabs = t;
    range = r;
  });
  return null;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('writers use the latest URL, not the last render', () => {
  it('a tab change keeps a range the router has written but React has not re-rendered yet', () => {
    window.history.replaceState(null, '', '/nodes/abc?tab=statistics');
    render(
      <BrowserRouter>
        <Probe />
      </BrowserRouter>
    );
    // Another writer got to the URL after this render and before the next one.
    window.history.replaceState(null, '', '/nodes/abc?tab=statistics&range=30d');
    act(() => tabs.onTabChange('traceroutes'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('traceroutes');
    expect(params.get('range')).toBe('30d');
  });

  it('a range change keeps a tab written but not yet rendered', () => {
    window.history.replaceState(null, '', '/nodes/abc');
    render(
      <BrowserRouter>
        <Probe />
      </BrowserRouter>
    );
    window.history.replaceState(null, '', '/nodes/abc?tab=traceroutes');
    act(() => range.setRange('90d'));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('traceroutes');
    expect(params.get('range')).toBe('90d');
  });

  it('falls back to the rendered params under a memory router', () => {
    render(
      <MemoryRouter initialEntries={['/nodes/abc?tab=statistics&range=30d&foo=1']}>
        <Probe />
      </MemoryRouter>
    );
    act(() => tabs.onTabChange('traceroutes'));
    // Still alive and consistent: the tab changed, the range survived.
    expect(tabs.activeTab).toBe('traceroutes');
    expect(range.key).toBe('30d');
  });
});
