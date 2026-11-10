import { test as base, expect, type Page } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const NODE_ID = '00000000-0000-4000-8000-0000000000dd';
const MESH_ID = 2996793270;
const HOUR = 3_600_000;

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
  last_heard: new Date(Date.now() - HOUR).toISOString(),
  latest_position: null,
  latest_device_metrics: null,
  latest_environment_metrics: null,
  latest_power_metrics: null,
};

/** Peers with the long names the real mesh has. Six of them, so "Show all links" has something to reveal. */
const PEERS = [
  { id: 1001, name: 'HLTP Hilltop Repeater North Ridge' },
  { id: 1002, name: 'GRNV' },
  { id: 1003, name: 'Glenfinnan Viaduct Visitor Centre Node' },
  { id: 1004, name: 'ABCD' },
  { id: 1005, name: '' },
  { id: 1006, name: 'LNLY' },
];

/** Samples in the last 20 hours, a few an hour apart, inbound on every link and outbound on some. */
function snrHistory() {
  const now = Date.now();
  return PEERS.map((p, i) => ({
    peer_node_id: p.id,
    peer_short_name: p.name,
    inbound: Array.from({ length: 8 - i }, (_, k) => ({
      triggered_at: new Date(now - (k * 2 + 1) * HOUR).toISOString(),
      snr: -12 + ((k + i) % 9),
    })),
    outbound: i % 2 === 0 ? [{ triggered_at: new Date(now - 3 * HOUR).toISOString(), snr: 3.5 - i }] : [],
  }));
}

const LINKS = {
  edges: PEERS.map((p, i) => ({
    from_node_id: MESH_ID,
    to_node_id: p.id,
    from_lat: 55.9,
    from_lng: -4.2,
    to_lat: 56 + i * 0.05,
    to_lng: -4.3 - i * 0.05,
    avg_snr_in: i === 0 ? 6.25 : -8 - i,
    avg_snr_out: null,
    count: 4,
  })),
  nodes: PEERS.map((p, i) => ({
    meshtastic_node_id: p.id,
    lat: 56 + i * 0.05,
    lng: -4.3 - i * 0.05,
    short_name: p.name,
  })),
  snr_history: snrHistory(),
};

const test = base.extend({
  context: async ({ context }, useFixture) => {
    await installApiMocks(context, {
      '**/api/nodes/observed-nodes/*/**': createJsonHandler([]),
      [`**/api/nodes/observed-nodes/${NODE_ID}/`]: createJsonHandler(NODE),
      [`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`]: createJsonHandler(LINKS),
      '**/api/traceroutes/**': createJsonHandler({ results: [], count: 23, next: null, previous: null }),
      '**/api/traceroutes/triggerable-nodes/**': createJsonHandler([]),
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

const noPageScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** What each range sends as `triggered_at_after`: how far back its window starts, in hours (bucket-aligned). */
const RANGES = [
  { range: '24h', minHours: 24, maxHours: 24 },
  { range: '7d', minHours: 168, maxHours: 174 },
  { range: '30d', minHours: 720, maxHours: 744 },
  { range: '90d', minHours: 2160, maxHours: 2184 },
] as const;

test.describe('Node Traceroutes tab', () => {
  for (const { range, minHours, maxHours } of RANGES) {
    test(`${range}: links and history both ask from the range start`, async ({ page }) => {
      const linkParams: URL[] = [];
      const historyParams: URL[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (url.pathname.endsWith(`/${NODE_ID}/traceroute-links/`)) linkParams.push(url);
        else if (/\/api\/traceroutes\/$/.test(url.pathname)) historyParams.push(url);
      });

      await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=${range}`);
      await expect(page.getByTestId('node-traceroute-tiles')).toBeVisible();
      await expect(page.getByTestId('node-traceroute-tile-links')).toContainText('6');
      await expect(page.getByTestId('node-traceroute-tile-traceroutes')).toContainText('23');
      await expect(page.getByTestId('node-traceroute-tile-best-snr')).toContainText('6.3');

      await expect.poll(() => linkParams.length).toBeGreaterThan(0);
      await expect.poll(() => historyParams.length).toBeGreaterThan(0);
      for (const [name, url, key] of [
        ['links', linkParams[0], 'triggered_at_after'],
        ['history', historyParams[0], 'triggered_after'],
      ] as const) {
        const since = url.searchParams.get(key);
        expect(since, `${name} ${key}`).toBeTruthy();
        const hoursBack = (Date.now() - new Date(since!).getTime()) / HOUR;
        expect(hoursBack).toBeGreaterThanOrEqual(minHours);
        expect(hoursBack).toBeLessThanOrEqual(maxHours + 1);
      }
      expect(historyParams[0].searchParams.get('target_node')).toBe(String(MESH_ID));
    });
  }

  test('the Traceroutes tile and the history table share one request', async ({ page }) => {
    const history: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (/\/api\/traceroutes\/$/.test(url.pathname) && url.searchParams.has('target_node')) history.push(req.url());
    });
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=7d`);
    await expect(page.getByTestId('node-traceroute-tile-traceroutes')).toContainText('23');
    await expect(page.getByTestId('node-traceroute-tile-traceroutes')).toContainText('to this node');
    await expect(page.getByTestId('node-traceroute-tile-peers')).toHaveCount(0);
    expect(history).toHaveLength(1);
  });

  test('SNR cards: four links first, then all; each has a headline and both directions', async ({ page }) => {
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=24h`);
    await expect(page.getByTestId('link-snr-charts')).toBeVisible();
    await expect(page.getByTestId('link-snr-charts').getByRole('heading', { level: 3 })).toHaveCount(4);
    await expect(page.getByTestId('chart-link-snr-1001-headline')).toContainText('avg in');
    await expect(page.getByTestId('chart-link-snr-1001-measure')).toContainText('per hour');
    await expect(page.getByTestId('chart-link-snr-1001').locator('.recharts-legend-wrapper')).toContainText(
      'SNR out (dB)'
    );
    // Points are actually drawn, not only counted in the headline.
    await expect(page.getByTestId('chart-link-snr-1001').locator('.recharts-dot').first()).toBeVisible();
    await page.getByRole('button', { name: /show all links \(2 more\)/i }).click();
    await expect(page.getByTestId('link-snr-charts').getByRole('heading', { level: 3 })).toHaveCount(6);
  });

  for (const range of ['7d', '90d']) {
    test(`${range}: the SNR view toggles to Raw samples and back to Means`, async ({ page }) => {
      await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=${range}`);
      const card = page.getByTestId('chart-link-snr-1001');
      await expect(page.getByRole('radio', { name: 'Bucket means' })).toBeChecked();
      await expect(card.getByTestId('chart-link-snr-1001-measure')).toContainText('Mean SNR');

      await page.getByRole('radio', { name: 'Raw samples' }).click();
      await expect(card.getByTestId('chart-link-snr-1001-measure')).toContainText("one traceroute's SNR");
      await expect(card.getByTestId('snr-points-chart')).toBeVisible();
      await expect(card.getByTestId('snr-points-legend')).toContainText('SNR out (dB)');
      // inbound circles and outbound triangles are drawn, one mark per sample
      await expect(card.locator('.recharts-scatter circle').first()).toBeVisible();
      await expect(card.locator('.recharts-scatter polygon').first()).toBeVisible();
      await expect(card.getByTestId('chart-link-snr-1001-headline')).toContainText('avg in');
      await expect(card.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveText([
        '-20',
        '-10',
        '0',
        '10',
      ]);

      await page.getByRole('radio', { name: 'Bucket means' }).click();
      await expect(card.getByTestId('chart-link-snr-1001-measure')).toContainText('Mean SNR');
      await expect(card.getByTestId('snr-points-chart')).toHaveCount(0);
    });
  }

  test('a link whose only sample is in the bucket in progress still draws its point (30d)', async ({ page }) => {
    await page.route(`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`, (route) =>
      route.fulfill({
        json: {
          ...LINKS,
          edges: LINKS.edges.slice(0, 1),
          snr_history: [
            {
              peer_node_id: 1001,
              peer_short_name: 'ONE',
              inbound: [{ triggered_at: new Date(Date.now() - 10 * 60_000).toISOString(), snr: -7 }],
              outbound: [],
            },
          ],
        },
      })
    );
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=30d`);
    const card = page.getByTestId('chart-link-snr-1001');
    await expect(card.getByTestId('chart-link-snr-1001-headline')).toContainText('avg in -7.0');
    await expect(card.locator('.recharts-dot')).toHaveCount(1);
  });

  test('a value outside -20..10 is clipped, ticks stay -20 to 10, and the card says so', async ({ page }) => {
    await page.route(`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`, (route) =>
      route.fulfill({
        json: {
          ...LINKS,
          edges: LINKS.edges.slice(0, 1),
          snr_history: [
            {
              peer_node_id: 1001,
              peer_short_name: 'WILD',
              inbound: [
                { triggered_at: new Date(Date.now() - 5 * HOUR).toISOString(), snr: 15 },
                { triggered_at: new Date(Date.now() - 9 * HOUR).toISOString(), snr: -30 },
                { triggered_at: new Date(Date.now() - 12 * HOUR).toISOString(), snr: 2 },
              ],
              outbound: [],
            },
          ],
        },
      })
    );
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=24h`);
    const card = page.getByTestId('chart-link-snr-1001');
    await expect(card).toContainText('2 points off the scale.');
    await expect(card.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')).toHaveText([
      '-20',
      '-10',
      '0',
      '10',
    ]);
  });

  test('the focus node alone, with no links, is no data: message, no tiles', async ({ page }) => {
    await page.route(`**/api/nodes/observed-nodes/${NODE_ID}/traceroute-links/**`, (route) =>
      route.fulfill({
        json: {
          edges: [],
          nodes: [{ meshtastic_node_id: MESH_ID, lat: 55.9, lng: -4.2, short_name: 'PDYl' }],
          snr_history: [],
        },
      })
    );
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=7d`);
    await expect(page.getByText('No traceroute data for this node')).toBeVisible();
    await expect(page.getByTestId('node-traceroute-tiles')).toHaveCount(0);
    await expect(page.getByTestId('link-snr-charts')).toHaveCount(0);
  });

  test('phone: tiles and cards fit with long peer names, no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/nodes/${NODE_ID}?tab=traceroutes&range=7d`);
    await expect(page.getByTestId('node-traceroute-tiles')).toBeVisible();
    await expect(page.getByTestId('chart-link-snr-1001').getByTestId('trend-chart')).toBeVisible();
    await page.getByRole('button', { name: /show all links/i }).click();
    await expect(page.getByTestId('chart-link-snr-1003').getByTestId('trend-chart')).toBeVisible();
    expect(await noPageScroll(page)).toBe(true);
    await page.getByRole('radio', { name: 'Raw samples' }).click();
    await expect(page.getByTestId('chart-link-snr-1003').getByTestId('snr-points-chart')).toBeVisible();
    await expect(page.getByTestId('chart-link-snr-1001').getByTestId('snr-points-chart')).toBeVisible();
    expect(await noPageScroll(page)).toBe(true);
  });
});
