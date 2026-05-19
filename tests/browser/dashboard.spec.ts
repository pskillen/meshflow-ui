import { test as base, expect } from '@playwright/test';
import { installApiMocks, loadFixture } from './api-mock';
import { DashboardPage } from './pages/DashboardPage';

// Install API mocks on context before any page is created, so config.json and API
// requests are intercepted before the app loads.
const test = base.extend({
  context: async ({ context }, use) => {
    await installApiMocks(context);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback, not React
    await use(context);
  },
});

test.describe('Dashboard', () => {
  test('dashboard loads with all sections', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test('recently active nodes table shows mock counts', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.recentlyActiveNodesHeading).toBeVisible();
    await dashboard.expectNodeCounts([5, 12]);
  });

  test('meshflow map section has link to nodes page', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.nodesPageLink).toBeVisible();
    await dashboard.clickNodesPageLink();
    await expect(page).toHaveURL(/\/nodes/);
  });

  test('node activity table shows empty state when no nodes', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectNodeActivityTableEmpty();
  });

  test.describe('with node data override', () => {
    test.beforeEach(async ({ context }) => {
      await context.unroute('**/observed-nodes/recent_counts/**');
      await context.unroute('**/api/nodes/observed-nodes/**');
      const nodesWithData = {
        results: [
          {
            meshtastic_node_id: 1,
            node_id_str: '!abc123',
            short_name: 'TestNode',
            long_name: 'Test Node',
            last_heard: new Date().toISOString(),
          },
        ],
        count: 1,
        next: null,
        previous: null,
      };
      await installApiMocks(context, {
        '**/api/nodes/observed-nodes/**': (route) => {
          if (route.request().url().includes('recent_counts')) {
            return route.fulfill({
              status: 200,
              body: JSON.stringify(loadFixture('observed-nodes-recent-counts.json')),
            });
          }
          return route.fulfill({ status: 200, body: JSON.stringify(nodesWithData) });
        },
      });
    });

    test('node activity table shows nodes when mock has data', async ({ page }) => {
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.expectNodeActivityTableHasNodes(1);
    });
  });
});
