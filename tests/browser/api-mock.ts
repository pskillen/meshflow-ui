import type { BrowserContext, Page, Route } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

export function loadFixture(name: string): unknown {
  const filePath = path.join(FIXTURES_DIR, name);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC midnight `daysAgo` days before today, as an ISO string. */
export function utcMidnightDaysAgo(daysAgo: number, now = Date.now()): string {
  return new Date(Math.floor(now / DAY_MS) * DAY_MS - daysAgo * DAY_MS).toISOString();
}

/**
 * The firmware fixture with its dates moved to now: newest row yesterday's UTC midnight, the rest a day apart going
 * back. A fixed date would age out of the 7d default range and silently empty the trend.
 */
export function loadFirmwareSnapshots(): { results: Array<{ recorded_at: string }> } {
  const body = loadFixture('stats-snapshots-node-firmware.json') as { results: Array<{ recorded_at: string }> };
  body.results.forEach((row, i) => {
    row.recorded_at = utcMidnightDaysAgo(i + 1);
  });
  return body;
}

export function createJsonHandler(body: unknown, status = 200) {
  return (route: Route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export function createPaginatedHandler<T>(results: T[]) {
  return createJsonHandler({
    results,
    count: results.length,
    next: null,
    previous: null,
  });
}

export type RouteHandler = (route: Route) => Promise<void> | void;

const DEFAULT_HANDLERS: Array<{ pattern: string | RegExp; handler: RouteHandler }> = [
  // Order of handlers is important. The last registered handler is the first to run.
  // nested routes must be registered after the parent route.
  ['**/config.json', createJsonHandler(loadFixture('config.json'))],
  ['**/api/auth/user/**', createJsonHandler(loadFixture('auth-user.json'))],
  ['**/api/nodes/observed-nodes/**', createJsonHandler(loadFixture('observed-nodes.json'))],
  [
    '**/api/nodes/observed-nodes/recent_counts**',
    (route) => {
      const url = route.request().url();
      const fixture = url.includes('protocol=meshcore')
        ? 'observed-nodes-recent-counts-meshcore.json'
        : 'observed-nodes-recent-counts.json';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(loadFixture(fixture)),
      });
    },
  ],
  ['**/api/nodes/managed-nodes/**', createJsonHandler(loadFixture('managed-nodes.json'))],
  ['**/api/constellations/**', createJsonHandler(loadFixture('constellations.json'))],
  ['**/api/stats/global/**', createJsonHandler(loadFixture('stats-global.json'))],
  [
    '**/api/stats/snapshots/**',
    (route: Route) => {
      const url = route.request().url();
      let fixture = 'stats-snapshots.json';
      if (url.includes('node_firmware')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(loadFirmwareSnapshots()),
        });
      } else if (url.includes('mc_packet_volume')) fixture = 'stats-snapshots-mc-packet-volume.json';
      else if (url.includes('packet_volume')) fixture = 'stats-snapshots-packet-volume.json';
      else if (url.includes('mc_online_nodes') || url.includes('mc_new_nodes'))
        fixture = 'stats-snapshots-mc-nodes.json';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(loadFixture(fixture)),
      });
    },
  ],
  ['**/ws/**', (route) => route.abort()],
].map(([pattern, handler]) => ({ pattern: pattern as string | RegExp, handler: handler as RouteHandler }));

type RouteTarget = Page | BrowserContext;

export async function installApiMocks(
  target: RouteTarget,
  overrides: Record<string, RouteHandler> = {}
): Promise<void> {
  const entries: Array<[string | RegExp, RouteHandler]> = DEFAULT_HANDLERS.map(({ pattern, handler }) => [
    pattern,
    handler,
  ]);
  for (const [pattern, handler] of Object.entries(overrides)) {
    entries.push([pattern, handler]);
  }

  for (const [pattern, handler] of entries) {
    await target.route(pattern, handler);
  }
}
