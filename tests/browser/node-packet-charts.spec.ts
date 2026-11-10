import { test as base, expect, type Page, type Route } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const NODE_ID = '00000000-0000-4000-8000-0000000000cc';
const MESH_ID = 2996793270;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const NODE = {
  internal_id: NODE_ID,
  meshtastic_node_id: MESH_ID,
  node_id_str: '!b29f6fb6',
  mac_addr: null,
  long_name: 'Paddy (Loft)',
  short_name: 'PDYl',
  meshtastic_hw_model: 'HELTEC_V4',
  meshtastic_public_key: null,
  meshtastic_role: 8,
  claim: null,
  owner: null,
  last_heard: new Date(Date.now() - 3600_000).toISOString(),
  latest_position: null,
  latest_device_metrics: null,
  latest_environment_metrics: null,
  latest_power_metrics: null,
};

const MANAGED = {
  meshtastic_node_id: MESH_ID,
  internal_id: 'managed-1',
  node_id_str: '!b29f6fb6',
  long_name: 'Paddy (Loft)',
  short_name: 'PDYl',
  last_heard: null,
  owner: { id: 1, username: 'paddy' },
  constellation: { id: 1, name: 'Test' },
  allow_auto_traceroute: false,
  default_location_latitude: null,
  default_location_longitude: null,
};

const TYPES = ['text_message', 'position', 'device_metrics', 'node_info', 'local_stats', 'environment_metrics'];

/** One interval per hour or day from `start_date` to `end_date`, one packet of each of the six types. */
function packetIntervals(route: Route) {
  const url = new URL(route.request().url());
  const step = url.searchParams.get('interval_type') === 'day' ? DAY : HOUR;
  const start = new Date(url.searchParams.get('start_date') ?? '').getTime();
  const end = new Date(url.searchParams.get('end_date') ?? '').getTime();
  const intervals = [];
  for (let t = start; t < end; t += step) {
    intervals.push({
      start_date: new Date(t).toISOString(),
      end_date: new Date(t + step).toISOString(),
      packets: TYPES.length,
      packet_types: TYPES.map((packet_type) => ({ packet_type, count: 1 })),
    });
  }
  const body = { intervals, summary: { time_range: { start: new Date(start), end: new Date(end) } } };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

function makeTest(managed: boolean) {
  return base.extend({
    context: async ({ context }, useFixture) => {
      await installApiMocks(context, {
        '**/api/nodes/observed-nodes/*/**': createJsonHandler([]),
        [`**/api/nodes/observed-nodes/${NODE_ID}/`]: createJsonHandler(NODE),
        [`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`]: createJsonHandler({
          edges: [],
          nodes: [],
          snr_history: [],
        }),
        '**/api/nodes/managed-nodes/**': createJsonHandler({
          results: managed ? [MANAGED] : [],
          count: managed ? 1 : 0,
          next: null,
          previous: null,
        }),
        [`**/api/stats/nodes/${MESH_ID}/packets/**`]: packetIntervals,
        [`**/api/stats/nodes/${MESH_ID}/received/**`]: packetIntervals,
        [`**/api/stats/nodes/${MESH_ID}/neighbours/**`]: createJsonHandler({
          start_date: null,
          end_date: null,
          total_packets: 7,
          by_source: [{ source: 'x', source_type: 'node', count: 7, candidates: [], label: 'Neighbour' }],
        }),
      });
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
      await useFixture(context);
    },
  });
}

const managedTest = makeTest(true);
const unmanagedTest = makeTest(false);

/** The interval type each range asks for, and the bar count it draws (24h-ish ranges vary by one with the clock). */
const RANGES = [
  { range: '24h', type: 'hour', min: 24, max: 25 },
  { range: '7d', type: 'hour', min: 28, max: 29 },
  { range: '30d', type: 'day', min: 30, max: 31 },
  { range: '90d', type: 'day', min: 90, max: 91 },
] as const;

const barRows = (page: Page, testId: string) =>
  page.getByTestId(testId).getByTestId('trend-chart-table').locator('tbody tr');

const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

managedTest.describe('Node packet charts (managed)', () => {
  for (const { range, type, min, max } of RANGES) {
    managedTest(`${range}: asks for ${type} intervals and draws one bar per bucket`, async ({ page }) => {
      const requests: URL[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (/\/stats\/nodes\/\d+\/(packets|received)\/$/.test(url.pathname)) requests.push(url);
      });

      await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=${range}`);
      await expect(page.getByTestId('chart-node-packets-sent')).toBeVisible();
      await expect(page.getByTestId('chart-node-packets-received')).toBeVisible();

      for (const id of ['chart-node-packets-sent', 'chart-node-packets-received']) {
        const count = await barRows(page, id).count();
        expect(count).toBeGreaterThanOrEqual(min);
        expect(count).toBeLessThanOrEqual(max);
      }
      expect(requests.length).toBeGreaterThanOrEqual(2);
      for (const url of requests) {
        expect(url.searchParams.get('interval_type')).toBe(type);
        expect(url.searchParams.get('interval')).toBe('1');
      }
    });
  }

  managedTest('Sent, Heard and Heard most from (after Load); no Other in the legend, stack order', async ({ page }) => {
    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=7d`);
    await expect(page.getByTestId('chart-node-packets-sent')).toBeVisible();
    await expect(page.getByTestId('chart-node-packets-received')).toBeVisible();
    await expect(page.getByTestId('chart-node-neighbours')).toHaveCount(0);
    await page.getByRole('button', { name: /Load .Heard most from/ }).click();
    await expect(page.getByTestId('chart-node-neighbours')).toBeVisible();
    await expect(page.getByTestId('neighbour-bars-row')).toHaveCount(1);

    const legend = page.getByTestId('chart-node-packets-sent').locator('.recharts-legend-wrapper');
    await expect(legend).toContainText('Text Message');
    expect(await legend.innerText()).toBe(
      ['Text Message', 'Position', 'Device Metrics', 'Node Info', 'Local Stats', 'Environment Metrics'].join('\n')
    );
  });

  managedTest('phone: the packet charts fit, the legend wraps, no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=7d`);
    await expect(page.getByTestId('chart-node-packets-sent').getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByTestId('chart-node-packets-received').getByTestId('trend-chart')).toBeVisible();
    await expect(page.getByTestId('chart-node-packets-sent').locator('.recharts-legend-wrapper')).toBeVisible();
    expect(await noPageScroll(page)).toBe(true);
  });
});

unmanagedTest.describe('Node packet charts (unmanaged)', () => {
  unmanagedTest('Sent packets only: no Heard packets, no Heard most from', async ({ page }) => {
    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=7d`);
    await expect(page.getByTestId('chart-node-packets-sent')).toBeVisible();
    await expect(page.getByTestId('chart-node-packets-received')).toHaveCount(0);
    await expect(page.getByTestId('chart-node-neighbours')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Load .Heard most from/ })).toHaveCount(0);
  });

  unmanagedTest('phone: the Sent chart fits with data', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/nodes/${NODE_ID}?tab=statistics&range=30d`);
    await expect(page.getByTestId('chart-node-packets-sent').getByTestId('trend-chart')).toBeVisible();
    expect(await noPageScroll(page)).toBe(true);
  });
});
