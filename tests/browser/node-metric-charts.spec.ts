import { test as base, expect } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const NODE_ID = '00000000-0000-4000-8000-0000000000bb';
const DAY = 86_400_000;

const NODE = {
  internal_id: NODE_ID,
  meshtastic_node_id: 2996793269,
  node_id_str: '!b29f6fb5',
  mac_addr: null,
  long_name: 'Paddy (Shed)',
  short_name: 'PDYs',
  meshtastic_hw_model: 'HELTEC_V4',
  meshtastic_public_key: null,
  meshtastic_role: 8,
  claim: null,
  owner: null,
  last_heard: new Date(Date.now() - 3600_000).toISOString(),
  latest_position: null,
  latest_device_metrics: {
    reported_time: new Date(Date.now() - 600_000).toISOString(),
    logged_time: new Date(Date.now() - 600_000).toISOString(),
    battery_level: 76,
    voltage: 3.9,
    meshtastic_channel_utilization: 14.3,
    meshtastic_air_util_tx: 2.8,
    uptime_seconds: 3 * 86400,
  },
  latest_environment_metrics: null,
  latest_power_metrics: null,
};

/** Bucketed device rows (one per UTC day) for the last 20 days: a battery that runs down, one powered day. */
function bucketedRows() {
  const today = Math.floor(Date.now() / DAY) * DAY;
  return Array.from({ length: 20 }, (_, i) => {
    const day = today - (19 - i) * DAY;
    return {
      node: 1,
      reported_time: new Date(day).toISOString(),
      samples: 24,
      voltage: 4.1 - i * 0.012,
      battery_level: i === 5 ? 101 : 95 - i * 2,
      meshtastic_channel_utilization: 8 + (i % 5),
      meshtastic_air_util_tx: 1 + (i % 3) * 0.4,
      uptime_seconds: 86400,
    };
  });
}

const test = base.extend({
  context: async ({ context }, useFixture) => {
    await installApiMocks(context, {
      '**/api/nodes/observed-nodes/*/**': createJsonHandler([]),
      [`**/api/nodes/observed-nodes/${NODE_ID}/`]: createJsonHandler(NODE),
      [`**/api/nodes/observed-nodes/${NODE_ID}/device_metrics/**`]: createJsonHandler(bucketedRows()),
      [`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`]: createJsonHandler({
        edges: [],
        nodes: [],
        snr_history: [],
      }),
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Node metric charts', () => {
  test('Battery and Channel and air use are separate charts that ask for the bucket matching the range', async ({
    page,
  }) => {
    const buckets: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname.endsWith('/device_metrics/')) buckets.push(url.searchParams.get('bucket') ?? '(none)');
    });

    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=30d`);
    const battery = page.getByTestId('chart-node-battery');
    const channel = page.getByTestId('chart-node-channel-air');
    await expect(battery).toBeVisible();
    await expect(channel).toBeVisible();
    await expect(battery.getByRole('heading', { name: 'Battery' })).toBeVisible();
    await expect(channel.getByRole('heading', { name: 'Channel and air use' })).toBeVisible();
    await expect(battery.getByTestId('trend-chart')).toBeVisible();
    await expect(channel.getByTestId('trend-chart')).toBeVisible();
    expect(buckets).toContain('1d');

    await page.getByRole('radio', { name: '90d' }).click();
    await expect(page).toHaveURL(/range=90d/);
    await expect(battery.getByTestId('trend-chart')).toBeVisible();
    await expect.poll(() => buckets.length).toBeGreaterThan(1);
    expect(new Set(buckets)).toEqual(new Set(['1d']));

    await page.getByRole('radio', { name: '7d' }).click();
    await expect.poll(() => buckets).toContain('6h');
  });

  test('a powered day reads as Powered, never as 101%', async ({ page }) => {
    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=30d`);
    const battery = page.getByTestId('chart-node-battery');
    await battery.getByRole('radio', { name: /percentage/i }).click();
    await expect(battery).toContainText('Powered (external supply) in 1 bucket');
    await expect(battery.getByTestId('trend-chart-table')).not.toContainText('101');
    await expect(battery.getByTestId('chart-node-battery-headline')).toHaveText(/%$/);
  });
});
