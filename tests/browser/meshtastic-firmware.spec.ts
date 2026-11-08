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
  test('renders pie and line in light and dark mode', async ({ page }) => {
    await page.goto('/meshtastic/dashboard');
    const card = page.getByTestId('firmware-adoption-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.recharts-pie-sector').first()).toBeVisible();
    await expect(card.locator('.recharts-line-curve').first()).toBeVisible();
    const breakdown = card.getByRole('list', { name: 'Firmware breakdown' });
    await expect(breakdown.getByText('2.7 or earlier')).toBeVisible();
    await expect(breakdown.getByText('Unknown', { exact: true })).toBeVisible();
    // Line chart legend repeats the labels, so series are identifiable without colour.
    await expect(card.getByText('Unknown', { exact: true })).toHaveCount(2);

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(card.locator('.recharts-pie-sector').first()).toBeVisible();
    await expect(card.locator('.recharts-line-curve').first()).toBeVisible();
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
