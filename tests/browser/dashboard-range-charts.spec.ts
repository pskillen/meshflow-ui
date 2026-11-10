import { test as base, expect } from '@playwright/test';
import type { Route } from '@playwright/test';
import { installApiMocks } from './api-mock';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const requests: URL[] = [];
/** Set per test: an API that has not deployed `bucket=1d` ignores it and returns hourly rows. */
let ignoreBucket = false;
/** Set per test: simulates the snapshot hole, so any window that ends before the current one starts has no rows. */
let noPreviousData = false;

/** Snapshots for any request: hourly rows, or UTC-day rollups when `bucket=1d` is asked for. */
function snapshots(route: Route) {
  const url = new URL(route.request().url());
  requests.push(url);
  const stat = url.searchParams.get('stat_type') ?? 'online_nodes';
  const after = new Date(url.searchParams.get('recorded_at_after') ?? Date.now() - 7 * DAY).getTime();
  const before = new Date(url.searchParams.get('recorded_at_before') ?? Date.now()).getTime();
  const flow = /packet_volume|new_nodes/.test(stat);
  const base = stat.startsWith('mc_') ? 20 : 80;
  const results = [];
  // The current window ends within the last hour; a previous window ends at least 24h ago.
  if (noPreviousData && before < Date.now() - 12 * HOUR) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, next: null, previous: null, results }),
    });
  }
  if (url.searchParams.get('bucket') === '1d' && !ignoreBucket) {
    for (let t = Math.ceil(after / DAY) * DAY; t < before; t += DAY) {
      const samples = Math.min(24, Math.floor((before - t) / HOUR));
      const hourly = base + Math.round(10 * Math.sin(t / DAY));
      results.push({
        id: null,
        recorded_at: new Date(t).toISOString(),
        stat_type: stat,
        constellation_id: null,
        value: { count: flow ? hourly * samples : hourly, samples },
      });
    }
  } else {
    for (let t = Math.ceil(after / HOUR) * HOUR; t < before; t += HOUR) {
      results.push({
        id: 1,
        recorded_at: new Date(t).toISOString(),
        stat_type: stat,
        constellation_id: null,
        value: {
          count: flow ? base + (Math.round(t / HOUR) % 7) : base + Math.round(8 * Math.sin(t / (3 * HOUR))),
          ...(stat.endsWith('packet_volume') ? { by_type: { text_message: 3, position: 4 } } : {}),
        },
      });
    }
  }
  results.reverse();
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
  });
}

const test = base.extend({
  context: async ({ context }, useFixture) => {
    requests.length = 0;
    ignoreBucket = false;
    noPreviousData = false;
    await installApiMocks(context, { '**/api/stats/snapshots/**': snapshots });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

const bar = (page: import('@playwright/test').Page) => page.getByTestId('stats-range-bar');

test.describe('Dashboard range charts', () => {
  test('three charts follow the bar, and the range carries between dashboards', async ({ page }) => {
    await page.goto('/meshtastic/dashboard');
    await expect(bar(page).getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Over the last 7 days')).toBeVisible();
    await expect(page.getByTestId('trend-chart')).toHaveCount(3);
    await expect(page.getByTestId('chart-online_nodes-headline')).toContainText('avg');
    await expect(page.getByTestId('chart-new_nodes-measure')).toContainText('6-hour bucket');
    await page.screenshot({ path: 'test-results/dash-7d.png', fullPage: true });

    await bar(page).getByRole('radio', { name: '90d' }).click();
    await expect(page.getByText('Over the last 90 days')).toBeVisible();
    await expect(page.getByTestId('chart-packet_volume-measure')).toContainText('UTC day');
    await expect.poll(() => requests.some((u) => u.searchParams.get('bucket') === '1d')).toBe(true);
    const daily = requests.filter((u) => u.searchParams.get('bucket') === '1d');
    expect(daily.every((u) => u.searchParams.has('recorded_at_after'))).toBe(true);
    // 90 days of rolled rows: every day is a bar slot, the day in progress is dashed
    await expect(page.getByTestId('chart-new_nodes').locator('.recharts-bar-rectangle')).toHaveCount(91);
    await expect(page.getByTestId('chart-new_nodes').locator('[stroke-dasharray="3 2"]')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/dash-90d.png', fullPage: true });

    // client-side navigation keeps the range (area memory)
    await page.goto('/meshcore/dashboard?range=90d');
    await expect(bar(page).getByRole('radio', { name: '90d' })).toHaveAttribute('aria-checked', 'true');
    await page.goto('/');
    await expect(bar(page).getByRole('radio', { name: '90d' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('trend-chart')).toHaveCount(3);
  });

  test('24h and 30d render, and Packet volume can split by type', async ({ page }) => {
    await page.goto('/meshtastic/dashboard?range=24h');
    await expect(page.getByTestId('chart-online_nodes-measure')).not.toContainText('mean');
    await page.screenshot({ path: 'test-results/dash-24h.png', fullPage: true });
    await bar(page).getByRole('radio', { name: '30d' }).click();
    await expect(page.getByText('Over the last 30 days')).toBeVisible();
    await page.screenshot({ path: 'test-results/dash-30d.png', fullPage: true });
    await page.getByRole('radio', { name: 'Packets by type' }).click();
    await expect(page.getByTestId('chart-packet_volume-measure')).toContainText('by packet type');
  });

  test('90d still renders when the API ignores bucket and returns hourly rows', async ({ page }) => {
    ignoreBucket = true;
    await page.goto('/meshtastic/dashboard?range=90d');
    await expect(page.getByText('Over the last 90 days')).toBeVisible();
    await expect.poll(() => requests.some((u) => u.searchParams.get('bucket') === '1d')).toBe(true);
    // The hourly rows are rolled up here: still one bar slot per UTC day, the day in progress dashed.
    await expect(page.getByTestId('chart-new_nodes').locator('.recharts-bar-rectangle')).toHaveCount(91);
    await expect(page.getByTestId('chart-new_nodes').locator('[stroke-dasharray="3 2"]')).toHaveCount(1);
    await expect(page.getByTestId('chart-packet_volume').locator('.recharts-bar-rectangle')).toHaveCount(91);
    await expect(page.getByTestId('chart-online_nodes').locator('.recharts-line-curve').first()).toBeVisible();
    await expect(page.getByTestId('chart-new_nodes-headline')).not.toContainText('partial');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: 'test-results/dash-90d-ignored-bucket.png', fullPage: true });
  });

  test('fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/meshtastic/dashboard?range=30d');
    await expect(page.getByTestId('trend-chart')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: 'test-results/dash-phone.png', fullPage: true });
  });

  const noHScroll = async (page: import('@playwright/test').Page) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  };

  for (const [name, size] of [
    ['desktop', { width: 1280, height: 900 }],
    ['phone', { width: 375, height: 800 }],
  ] as const) {
    test(`previous-period change shows at every preset on ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const preset of ['24h', '7d', '30d', '90d']) {
        await page.goto(`/meshtastic/dashboard?range=${preset}`);
        for (const id of ['online_nodes', 'new_nodes', 'packet_volume']) {
          await expect(page.getByTestId(`chart-${id}-delta`)).toHaveText(
            new RegExp(`^[+\\u2212]?\\d+% vs previous ${preset}$|^No change vs previous ${preset}$`)
          );
        }
        await noHScroll(page);
      }
    });
  }

  test('previous-period change is neutral when the previous window has no data', async ({ page }) => {
    noPreviousData = true;
    await page.goto('/meshtastic/dashboard?range=7d');
    await expect(page.getByTestId('chart-packet_volume-delta')).toHaveText('No comparison');
    await expect(page.getByTestId('chart-online_nodes-delta')).not.toContainText('%');
    await expect(page.getByTestId('trend-chart')).toHaveCount(3);
  });

  test('the neutral line stays on one row at 375px and the titles do not wrap', async ({ page }) => {
    noPreviousData = true;
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/meshtastic/dashboard?range=7d');
    for (const id of ['online_nodes', 'new_nodes', 'packet_volume']) {
      const delta = page.getByTestId(`chart-${id}-delta`);
      await expect(delta).toHaveText('No comparison');
      const box = await delta.boundingBox();
      expect(box!.height).toBeLessThan(20);
      const title = await page.getByTestId(`chart-${id}`).getByRole('heading', { level: 3 }).boundingBox();
      expect(title!.height).toBeLessThan(20);
    }
    await noHScroll(page);
  });

  test('makes one previous-window request per stat type per chart', async ({ page }) => {
    await page.goto('/?range=24h');
    await expect(page.getByTestId('chart-packet_volume-delta')).toBeVisible();
    const earlier = requests.filter(
      (u) => new Date(u.searchParams.get('recorded_at_before')!).getTime() < Date.now() - 12 * HOUR
    );
    const byStat = new Map<string, number>();
    for (const u of earlier)
      byStat.set(u.searchParams.get('stat_type')!, (byStat.get(u.searchParams.get('stat_type')!) ?? 0) + 1);
    expect([...byStat.keys()].sort()).toEqual(
      ['mc_new_nodes', 'mc_online_nodes', 'mc_packet_volume', 'new_nodes', 'online_nodes', 'packet_volume'].sort()
    );
    expect([...byStat.values()].every((n) => n === 1)).toBe(true);
  });

  test('home overlays both protocols', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('trend-chart')).toHaveCount(3);
    await expect(page.getByTestId('chart-online_nodes').getByTestId('trend-chart').getByText('MeshCore')).toBeVisible();
    await page.screenshot({ path: 'test-results/dash-home.png', fullPage: true });
  });
});
