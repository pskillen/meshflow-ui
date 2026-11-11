import { test as base, expect, type Route } from '@playwright/test';
import { createJsonHandler, installApiMocks } from './api-mock';

const OLD_ID = '00000000-0000-4000-8000-0000000000a1';
const NEW_ID = '00000000-0000-4000-8000-0000000000b2';

const NEW_REF = { internal_id: NEW_ID, protocol: 1, meshtastic_node_id: 0x5678ef01, node_id_str: '!5678ef01' };

/** The old node: replaced by a newer number, owned by the signed-in user (id 1, set in localStorage below). */
const OLD_NODE = {
  internal_id: OLD_ID,
  protocol: 1,
  meshtastic_node_id: 0x1234abcd,
  node_id_str: '!1234abcd',
  mac_addr: null,
  long_name: 'Roof radio',
  short_name: 'ROOF',
  meshtastic_hw_model: 'HELTEC_V4',
  meshtastic_public_key: null,
  meshtastic_role: 8,
  claim: null,
  owner: { id: 1, username: 'testuser' },
  last_heard: new Date(Date.now() - 3 * 3600_000).toISOString(),
  latest_position: null,
  latest_device_metrics: null,
  latest_environment_metrics: null,
  latest_power_metrics: null,
  replaced_by: NEW_REF,
  identity_chain: {
    previous: [],
    next: [
      {
        ...NEW_REF,
        long_name: 'Roof radio',
        short_name: 'ROOF',
        last_heard: new Date(Date.now() - 600_000).toISOString(),
        evidence: 'public_key',
        state: 'auto',
        linked_at: new Date(Date.now() - 86400_000).toISOString(),
      },
    ],
  },
};

function makeLink(state: string, canConfirm: boolean) {
  return {
    id: 5,
    old: {
      internal_id: OLD_ID,
      protocol: 1,
      meshtastic_node_id: 0x1234abcd,
      node_id_str: '!1234abcd',
      long_name: 'Roof radio',
    },
    new: { ...NEW_REF, long_name: 'Roof radio' },
    evidence: 'public_key',
    confidence: 'strong',
    state,
    created_at: new Date(Date.now() - 86400_000).toISOString(),
    reviewed_at: null,
    can_confirm: canConfirm,
    can_reject: true,
  };
}

let linkState = 'suggested';
const confirmRequests: string[] = [];
const declareBodies: unknown[] = [];

const test = base.extend({
  context: async ({ context }, useFixture) => {
    linkState = 'suggested';
    confirmRequests.length = 0;
    declareBodies.length = 0;
    await context.addInitScript(() => {
      localStorage.setItem('meshflow_access_token', 'test-token');
      localStorage.setItem('meshflow_user_details', JSON.stringify({ id: 1, username: 'testuser' }));
    });
    await installApiMocks(context, {
      '**/api/nodes/observed-nodes/*/**': createJsonHandler([]),
      [`**/api/nodes/observed-nodes/${OLD_ID}/`]: createJsonHandler(OLD_NODE),
      '**/api/nodes/observed-nodes/search/**': createJsonHandler([
        {
          internal_id: NEW_ID,
          node_id_str: '!5678ef01',
          meshtastic_node_id: 0x5678ef01,
          short_name: 'NEW1',
          long_name: 'New roof radio',
        },
      ]),
      [`**/api/nodes/observed-nodes/${OLD_ID}/identity-links/`]: (route: Route) => {
        if (route.request().method() === 'POST') {
          declareBodies.push(route.request().postDataJSON());
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(makeLink('confirmed', false)),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([makeLink(linkState, linkState === 'suggested')]),
        });
      },
      '**/api/nodes/identity-links/5/confirm/': (route: Route) => {
        confirmRequests.push(route.request().method());
        linkState = 'confirmed';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeLink('confirmed', false)),
        });
      },
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback
    await useFixture(context);
  },
});

test.describe('Node identity review', () => {
  test('the old page says the radio now uses the new number, and the owner can confirm the suggested link', async ({
    page,
  }) => {
    await page.goto(`/nodes/${OLD_ID}`);

    const banner = page.getByTestId('node-identity-replaced');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('This radio now uses node !5678ef01');

    const section = page.getByTestId('node-identity-links');
    await expect(section).toBeVisible();
    const row = section.getByTestId('node-identity-link');
    await expect(row).toContainText('Same radio as node !5678ef01');
    await expect(row).toContainText('suggested by Meshflow');
    await expect(row.getByRole('button', { name: 'Not the same radio' })).toBeVisible();

    await row.getByRole('button', { name: 'Confirm' }).click();

    await expect(row.getByText('confirmed', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
    expect(confirmRequests).toEqual(['POST']);
  });

  test('the owner can declare a replacement by picking a node from the real search', async ({ page }) => {
    await page.goto(`/nodes/${OLD_ID}`);
    await page.getByRole('button', { name: 'Declare a replacement' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Search nodes...').fill('5678');
    await dialog.getByText('New roof radio').click();
    await expect(dialog.getByRole('textbox')).toHaveValue('!5678ef01 (New roof radio)');
    await dialog.getByRole('button', { name: 'Declare replacement' }).click();
    await expect(dialog).toHaveCount(0);
    expect(declareBodies).toEqual([{ new_node: '!5678ef01' }]);
  });

  test('a guest sees the banner but not the review section', async ({ context, page }) => {
    await context.clearCookies();
    await page.addInitScript(() => localStorage.clear());
    await page.goto(`/nodes/${OLD_ID}`);
    await expect(page.getByTestId('node-identity-replaced')).toBeVisible();
    await expect(page.getByTestId('node-identity-links')).toHaveCount(0);
  });
});
