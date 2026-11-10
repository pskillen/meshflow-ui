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

  test('stats come before the map on desktop', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const stats = page.getByTestId('dashboard-mesh-stats');
    const map = page.getByTestId('dashboard-meshflow-map');
    await expect(stats).toBeVisible();
    await expect(map.getByText('Meshflow Map')).toBeVisible();
    const statsBox = await stats.boundingBox();
    const mapBox = await map.boundingBox();
    expect(statsBox!.y + statsBox!.height).toBeLessThanOrEqual(mapBox!.y + 1);
    await expect(page.getByTestId('dashboard-map-toggle')).toHaveCount(0);
  });

  test('the map is collapsed on phones until asked for', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    const map = page.getByTestId('dashboard-meshflow-map');
    await expect(page.getByTestId('dashboard-mesh-stats')).toBeVisible();
    await expect(map.locator('.leaflet-container')).toHaveCount(0);
    await map.getByTestId('dashboard-map-toggle').click();
    await expect(map.locator('.leaflet-container')).toBeVisible();
    await map.getByTestId('dashboard-map-toggle').click();
    await expect(map.locator('.leaflet-container')).toHaveCount(0);
  });
});
