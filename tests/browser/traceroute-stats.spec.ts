import { test as base, expect } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const SOURCE = {
  managed_node_id: 'm1',
  meshtastic_node_id: 12,
  node_id_str: '!0000000c',
  name: 'Alpha',
  short_name: 'ALP',
  total: 10,
  completed: 8,
  failed: 2,
  success_rate: 0.8,
};

const STATS = {
  sources: [{ trigger_type: 3, count: 10 }],
  success_failure: [
    { status: 'completed', count: 8 },
    { status: 'failed', count: 2 },
  ],
  top_routers: [],
  by_source: [SOURCE],
  by_target: [
    {
      meshtastic_node_id: 21,
      node_id_str: '!00000015',
      short_name: 'TGT',
      long_name: null,
      total: 8,
      completed: 7,
      failed: 1,
      success_rate: 0.875,
    },
  ],
  success_over_time: [{ date: '2026-11-08', completed: 8, failed: 2 }],
  by_strategy: { intra_zone: { completed: 8, failed: 2, pending: 0, sent: 0 } },
  by_strategy_excluding_external: { intra_zone: { completed: 8, failed: 2, pending: 0, sent: 0 } },
};

/** `success_over_time` for `bucket=1h`: one row per UTC hour from the hour containing the start to the current hour. */
function hourlyRows(startIso: string) {
  const HOUR = 3_600_000;
  const first = Math.floor(new Date(startIso).getTime() / HOUR) * HOUR;
  const last = Math.floor(Date.now() / HOUR) * HOUR;
  const rows = [];
  for (let t = first; t <= last; t += HOUR) {
    rows.push({
      date: new Date(t).toISOString().slice(0, 10),
      bucket_start: new Date(t).toISOString(),
      completed: 1,
      failed: 0,
    });
  }
  return rows;
}

const statsRequests: string[] = [];

/** Query params of the most recent stats request. */
function lastStatsParams(): URLSearchParams {
  const url = statsRequests[statsRequests.length - 1];
  return new URL(url ?? 'http://none/').searchParams;
}

/** Hours between `triggered_at_after` on the last stats request and now. */
function lastStartAgeHours(): number {
  return (Date.now() - new Date(lastStatsParams().get('triggered_at_after') ?? '').getTime()) / 3600_000;
}

const test = base.extend({
  context: async ({ context }, useFixture) => {
    statsRequests.length = 0;
    await installApiMocks(context, {
      '**/api/traceroutes/triggerable-nodes/**': createJsonHandler([
        { ...SOURCE, name: 'Alpha', node_id_str: '!0000000c' },
      ]),
      '**/api/traceroutes/stats/**': (route) => {
        const url = route.request().url();
        statsRequests.push(url);
        const params = new URL(url).searchParams;
        if (params.get('bucket') === '1h') {
          return createJsonHandler({
            ...STATS,
            success_over_time: hourlyRows(params.get('triggered_at_after') ?? ''),
          })(route);
        }
        return createJsonHandler(STATS)(route);
      },
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Traceroute statistics range', () => {
  test('range lives in the URL, survives reload and keeps source_node', async ({ page }) => {
    await page.goto('/traceroutes?source_node=12');
    const bar = page.getByTestId('stats-range-bar');
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('radio')).toHaveText(['24h', '7d', '30d', '90d']);
    await expect(bar.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');

    // 7d: start is a UTC 6-hour boundary, 7 to 7.25 days back, and the source filter rides along
    await expect.poll(() => statsRequests.length).toBeGreaterThan(0);
    const start7 = new Date(lastStatsParams().get('triggered_at_after') ?? '');
    expect(start7.getUTCMinutes()).toBe(0);
    expect(start7.getUTCHours() % 6).toBe(0);
    expect(lastStartAgeHours()).toBeGreaterThanOrEqual(168);
    expect(lastStartAgeHours()).toBeLessThan(175);
    expect(lastStatsParams().get('source_node')).toBe('12');

    const before = statsRequests.length;
    await bar.getByRole('radio', { name: '30d' }).click();
    await expect(page).toHaveURL(/range=30d/);
    await expect(page).toHaveURL(/source_node=12/);

    // 30d: a new request whose start is UTC midnight, 30 to 31 days back, still filtered by source
    await expect.poll(() => statsRequests.length).toBeGreaterThan(before);
    const start30 = new Date(lastStatsParams().get('triggered_at_after') ?? '');
    expect(start30.getUTCHours()).toBe(0);
    expect(start30.getUTCMinutes()).toBe(0);
    expect(lastStartAgeHours()).toBeGreaterThanOrEqual(720);
    expect(lastStartAgeHours()).toBeLessThan(745);
    expect(lastStatsParams().get('source_node')).toBe('12');

    await page.reload();
    await expect(page.getByTestId('stats-range-bar').getByRole('radio', { name: '30d' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(page).toHaveURL(/source_node=12/);
    await expect(page.locator('body')).toContainText('Outcomes');
    await expect.poll(lastStartAgeHours).toBeGreaterThanOrEqual(720);
  });

  test('an invalid range falls back to 7d', async ({ page }) => {
    await page.goto('/traceroutes?range=all');
    await expect(page.getByTestId('stats-range-bar').getByRole('radio', { name: '7d' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // the address bar is corrected to what the page shows, and the request is for 7 days
    await expect(page).toHaveURL(/range=7d/);
    await expect.poll(() => statsRequests.length).toBeGreaterThan(0);
    expect(lastStartAgeHours()).toBeGreaterThanOrEqual(168);
    expect(lastStartAgeHours()).toBeLessThan(175);
  });

  test('arrow keys change the range', async ({ page }) => {
    await page.goto('/traceroutes');
    const bar = page.getByTestId('stats-range-bar');
    await bar.getByRole('radio', { name: '7d' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(bar.getByRole('radio', { name: '30d' })).toHaveAttribute('aria-checked', 'true');
    await expect(bar.getByRole('radio', { name: '30d' })).toBeFocused();
    await expect(page).toHaveURL(/range=30d/);
  });

  test('24h asks for hourly data and draws one bar per hour', async ({ page }) => {
    await page.goto('/traceroutes?range=24h');
    await expect.poll(() => statsRequests.length).toBeGreaterThan(0);
    expect(lastStatsParams().get('bucket')).toBe('1h');
    const card = page.getByTestId('traceroute-outcomes-card');
    await expect(card.getByTestId('trend-chart')).toBeVisible();
    await expect(card.getByTestId('traceroute-outcomes-card-measure')).toContainText('per hour');
    await expect(card.locator('.recharts-bar-rectangle')).toHaveCount(50); // 25 hours x completed and failed
  });

  test('7d does not ask for hourly data and shows UTC days', async ({ page }) => {
    await page.goto('/traceroutes?range=7d');
    await expect(page.getByTestId('traceroute-outcomes-card-measure')).toContainText('per UTC day');
    expect(lastStatsParams().get('bucket')).toBeNull();
  });

  test('tiles and bars show, and the tables open', async ({ page }) => {
    await page.goto('/traceroutes');
    await expect(page.getByTestId('tile-success-rate')).toContainText('80%');
    await expect(page.getByTestId('traceroute-by-feeder-card').getByRole('list')).toContainText('ALP');
    await page.getByTestId('traceroute-by-feeder-card').getByRole('button', { name: 'Show table' }).click();
    await expect(page.getByTestId('traceroute-by-feeder-card').getByRole('table')).toContainText('!0000000c');
  });

  test('on a phone nothing scrolls sideways, tables open, and the range bar stays compact', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/traceroutes');
    await expect(page.getByTestId('tile-success-rate')).toBeVisible();
    for (const id of ['traceroute-by-feeder-card', 'traceroute-by-strategy-card', 'traceroute-top-targets-card']) {
      await page.getByTestId(id).getByRole('button', { name: 'Show table' }).click();
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const bar = await page.getByTestId('stats-range-bar').boundingBox();
    expect(bar?.height ?? 999).toBeLessThan(100);
  });
});
