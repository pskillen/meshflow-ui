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

  test('recently active nodes table shows MT and MC mock counts', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.recentlyActiveNodesHeading).toBeVisible();
    const section = page.getByTestId('dashboard-recently-active-nodes');
    await expect(section.getByRole('row', { name: /Meshtastic/i })).toContainText('5');
    await expect(section.getByRole('row', { name: /Meshtastic/i })).toContainText('12');
    await expect(section.getByRole('row', { name: /MeshCore/i })).toContainText('2');
  });

  test('meshflow map section has link to nodes page', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.nodesPageLink).toBeVisible();
    await dashboard.clickNodesPageLink();
    await expect(page).toHaveURL(/\/nodes/);
  });
});
