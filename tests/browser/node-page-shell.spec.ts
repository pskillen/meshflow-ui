import { test as base, expect } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const NODE_ID = '00000000-0000-4000-8000-0000000000aa';

const NODE = {
  internal_id: NODE_ID,
  meshtastic_node_id: 2996793268,
  node_id_str: '!b29f6fb4',
  mac_addr: null,
  long_name: 'Paddy (Attic)',
  short_name: 'PDYa',
  meshtastic_hw_model: 'HELTEC_V4',
  meshtastic_public_key: null,
  meshtastic_role: 8,
  claim: null,
  owner: null,
  last_heard: new Date(Date.now() - 3 * 3600_000).toISOString(),
  latest_position: null,
  latest_device_metrics: {
    reported_time: new Date(Date.now() - 600_000).toISOString(),
    logged_time: new Date(Date.now() - 600_000).toISOString(),
    battery_level: 101,
    voltage: 4.08,
    meshtastic_channel_utilization: 14.3,
    meshtastic_air_util_tx: 2.8,
    uptime_seconds: 14 * 86400,
  },
  latest_environment_metrics: null,
  latest_power_metrics: null,
};

const test = base.extend({
  context: async ({ context }, useFixture) => {
    await installApiMocks(context, {
      '**/api/nodes/observed-nodes/*/**': createJsonHandler([]),
      [`**/api/nodes/observed-nodes/${NODE_ID}/`]: createJsonHandler(NODE),
      [`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`]: createJsonHandler({
        edges: [],
        nodes: [],
        snr_history: [],
      }),
      // Statistics tab charts: empty stats, so a direct ?tab=statistics load doesn't hit a 404.
      '**/api/stats/nodes/**': createJsonHandler({
        start_date: new Date(Date.now() - 7 * 86400_000).toISOString(),
        end_date: new Date().toISOString(),
        intervals: [],
        summary: { total_packets: 0, time_range: { start: '', end: '' } },
      }),
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Node page shell', () => {
  test('Right now on Overview, no range bar; Statistics gets the bar and keeps the range across tabs', async ({
    page,
  }) => {
    await page.goto(`/nodes/${NODE_ID}`);
    await expect(page.getByTestId('node-right-now')).toBeVisible();
    await expect(page.getByTestId('node-right-now-tile-battery')).toContainText('Powered');
    await expect(page.getByTestId('stats-range-bar')).toHaveCount(0);

    await page.getByTestId('node-detail-tab-statistics').click();
    await expect(page.getByTestId('stats-range-bar')).toBeVisible();
    await page.getByRole('radio', { name: '30d' }).click();
    await expect(page).toHaveURL(/range=30d/);
    // Wait for the re-render too, so the next click cannot race it.
    await expect(page.getByRole('radio', { name: '30d' })).toBeChecked();

    await page.getByTestId('node-detail-tab-traceroutes').click();
    await expect(page).toHaveURL(/tab=traceroutes/);
    await expect(page).toHaveURL(/range=30d/);
    await expect(page.getByRole('radio', { name: '30d' })).toBeChecked();
  });

  test('the header stays at the top of the viewport while scrolling', async ({ page }) => {
    await page.goto(`/nodes/${NODE_ID}?tab=statistics`);
    const header = page.getByTestId('node-shell-header');
    await expect(header).toBeVisible();
    await page.evaluate(() => {
      document.body.style.minHeight = '4000px';
      const main = document.querySelector('main');
      (main ?? document.scrollingElement)?.scrollTo(0, 800);
      window.scrollTo(0, 800);
    });
    const box = await header.boundingBox();
    expect(box?.y ?? 999).toBeLessThan(5);
  });

  test('phone: Right now is a one-row table and the range fits', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/nodes/${NODE_ID}?tab=statistics`);
    await expect(page.getByTestId('node-right-now-table')).toBeVisible();
    await expect(page.getByTestId('node-right-now-tiles')).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
