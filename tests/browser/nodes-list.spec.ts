import { test as base, expect } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

function apiNode(i: number, name: string) {
  return {
    internal_id: `00000000-0000-0000-0000-00000000000${i}`,
    node_id: i,
    node_id_str: `!${i.toString(16).padStart(8, '0')}`,
    mac_addr: null,
    long_name: name,
    short_name: name.slice(0, 4),
    hw_model: null,
    sw_version: null,
    public_key: null,
    last_heard: new Date(Date.now() - i * 60_000).toISOString(),
    protocol: 1,
    latest_position: { latitude: 55.8 + i / 100, longitude: -4.2, altitude: null, reported_time: null },
    latest_device_metrics: { battery_level: i === 2 ? 101 : 60, voltage: 4, channel_utilization: 1, air_util_tx: 1 },
  };
}

const NODES = [apiNode(1, 'Alpha Base'), apiNode(2, 'Bravo Relay'), apiNode(3, 'Charlie Hill')];

const requests: string[] = [];

const test = base.extend({
  context: async ({ context }, useFixture) => {
    requests.length = 0;
    await installApiMocks(context, {
      '**/api/nodes/observed-nodes/?**': (route) => {
        requests.push(route.request().url());
        return createJsonHandler({ results: NODES, count: 3, next: null, previous: null })(route);
      },
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

function lastParams(): URLSearchParams {
  return new URL(requests[requests.length - 1] ?? 'http://none/').searchParams;
}

function ageHours(): number {
  return (Date.now() - new Date(lastParams().get('last_heard_after') ?? '').getTime()) / 3_600_000;
}

test.describe('Meshtastic node list', () => {
  test('range bar, rolling Online (2h), search between map and list', async ({ page }) => {
    await page.goto('/nodes');
    const bar = page.getByTestId('stats-range-bar');
    await expect(bar.getByRole('radio')).toHaveText(['Online (2h)', '24h', '7d', '30d', '90d']);
    await expect(bar.getByRole('radio', { name: '7d' })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(ageHours()).toBeGreaterThanOrEqual(168);

    await bar.getByRole('radio', { name: 'Online (2h)' }).click();
    await expect(page).toHaveURL(/range=2h/);
    await expect.poll(ageHours).toBeLessThan(2.2);
    expect(ageHours()).toBeGreaterThanOrEqual(2);

    // Search sits below the map and above the cards, and filters both.
    const search = page.getByRole('textbox', { name: 'Search nodes', exact: true });
    const map = page.locator('.map-container').first();
    const firstCard = page.getByRole('link', { name: /Alpha Base/ }).first();
    const mapBox = (await map.boundingBox())!;
    const searchBox = (await search.boundingBox())!;
    const cardBox = (await firstCard.boundingBox())!;
    expect(searchBox.y).toBeGreaterThanOrEqual(mapBox.y + mapBox.height - 1);
    expect(cardBox.y).toBeGreaterThan(searchBox.y);
    await search.fill('bravo');
    await expect(page.getByTestId('nodes-count')).toContainText('1 of 3 heard in last 2 hours');
  });

  test('on a phone the map key is a button, closed by default', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/nodes');
    const key = page.getByRole('region', { name: 'Map marker colours' });
    const button = page.getByRole('button', { name: 'Map key' });
    await expect(button).toBeVisible();
    await expect(key).toBeHidden();
    await button.click();
    await expect(key).toBeVisible();
    await page.getByRole('button', { name: 'Hide key' }).click();
    await expect(key).toBeHidden();
  });

  test('on a desktop the key is always shown and there is no button', async ({ page }) => {
    await page.goto('/nodes');
    await expect(page.getByRole('region', { name: 'Map marker colours' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Map key' })).toBeHidden();
  });
});
