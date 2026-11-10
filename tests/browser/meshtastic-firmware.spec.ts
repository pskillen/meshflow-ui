import { test as base, expect, type Route } from '@playwright/test';
import { installApiMocks } from './api-mock';

const SNAPSHOTS = '**/api/stats/snapshots/**';

/** Override node_firmware responses only; everything else falls through to the default mock. */
function firmwareOverride(results: unknown[]) {
  return {
    [SNAPSHOTS]: (route: Route) => {
      if (!route.request().url().includes('node_firmware')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: results.length, next: null, previous: null, results }),
      });
    },
  };
}

const oneRow = [
  {
    id: 1,
    recorded_at: '2026-11-08T00:00:00Z',
    stat_type: 'node_firmware',
    constellation_id: null,
    value: { count: 10, window_hours: 168, by_type: { '2.7': 6, unknown: 4 } },
  },
];

const test = base.extend({
  context: async ({ context }, useFixture) => {
    await installApiMocks(context);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Meshtastic dashboard firmware adoption', () => {
  test('renders the split bar and trend in light and dark mode', async ({ page }) => {
    await page.goto('/meshtastic/dashboard');
    const card = page.getByTestId('firmware-adoption-card');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('firmware-split-bar')).toBeVisible();
    await expect(card.locator('.recharts-line-curve').first()).toBeVisible();
    await expect(card.getByText(/Split: nodes heard in the last 7d/)).toBeVisible();
    const breakdown = card.getByRole('list', { name: 'Firmware breakdown' });
    await expect(breakdown.getByText('2.7 or earlier')).toBeVisible();
    await expect(breakdown.getByText('Unknown', { exact: true })).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(card.getByTestId('firmware-split-bar')).toBeVisible();
    await expect(card.locator('.recharts-line-curve').first()).toBeVisible();
  });

  test('a phone gets counts and the trend, no split graphic', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/meshtastic/dashboard');
    const card = page.getByTestId('firmware-adoption-card');
    await expect(card.getByRole('list', { name: 'Firmware breakdown' })).toBeVisible();
    await expect(card.getByTestId('firmware-split-bar')).toBeHidden();
    await expect(card.locator('.recharts-pie-sector')).toHaveCount(0);
    await expect(card.locator('.recharts-line-curve').first()).toBeVisible();
  });

  test('the trend follows the range and the split does not', async ({ page }) => {
    await page.goto('/meshtastic/dashboard?range=24h');
    const card = page.getByTestId('firmware-adoption-card');
    await expect(card.getByText(/Split: nodes heard in the last 7d/)).toBeVisible();
    await expect(card.getByText(/daily snapshots? in this range/)).toBeVisible();
    await expect(card.getByRole('img', { name: /Firmware adoption, last 24 hours/ })).toBeVisible();
  });

  test('a single snapshot still draws the line dots', async ({ context, page }) => {
    await installApiMocks(context, firmwareOverride(oneRow));
    await page.goto('/meshtastic/dashboard');
    const card = page.getByTestId('firmware-adoption-card');
    await expect(card.locator('.recharts-line-dot').first()).toBeVisible();
  });

  test('no rows shows the empty state', async ({ context, page }) => {
    await installApiMocks(context, firmwareOverride([]));
    await page.goto('/meshtastic/dashboard');
    await expect(page.getByTestId('firmware-adoption-card').getByText('No firmware data yet')).toBeVisible();
  });
});
