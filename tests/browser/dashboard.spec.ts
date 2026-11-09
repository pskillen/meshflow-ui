import { test as base, expect } from '@playwright/test';
import { installApiMocks } from './api-mock';
import { DashboardPage } from './pages/DashboardPage';

const test = base.extend({
  context: async ({ context }, useFixture) => {
    await installApiMocks(context);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Dashboard', () => {
  test('dashboard loads with all sections', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('right now band shows totals with MT and MC counts', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.recentlyActiveNodesHeading).toBeVisible();
    const online = page.getByTestId('right-now-tile-2');
    await expect(online).toContainText('Online now');
    await expect(online).toContainText('7');
    await expect(online).toContainText('MT 5 · MC 2');
    await expect(page.getByTestId('right-now-tile-24')).toContainText('MT 12 · MC 4');
    await expect(page.getByTestId('right-now-table')).toBeHidden();
  });

  test('right now shows a compact table on phones', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const table = page.getByTestId('right-now-table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('row', { name: /Meshtastic/ })).toContainText('12');
    await expect(table.getByRole('row', { name: /MeshCore/ })).toContainText('4');
    await expect(page.getByTestId('right-now-tiles')).toBeHidden();
  });

  test('meshflow map section has link to nodes page', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.nodesPageLink).toBeVisible();
    await dashboard.clickNodesPageLink();
    await expect(page).toHaveURL(/\/nodes/);
  });
});
