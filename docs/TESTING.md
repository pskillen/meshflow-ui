# Running Tests

This document explains how to run unit and browser tests for the Meshtastic Bot UI.

## Unit tests (Vitest)

Unit tests use Vitest and run in Node with jsdom. No external services are required.

```bash
npm install
npm test
```

Other commands:

```bash
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
npm run test:coverage # With coverage
```

## Browser tests (Playwright)

Browser tests use Playwright to run end-to-end tests in a real Chromium instance. They exercise the UI as a user would, including routing, interactions, and visual elements.

### Prerequisites

1. **Install Playwright browsers** (required once per machine or after Playwright upgrade):

   ```bash
   npx playwright install chromium
   ```

2. **Optional: Meshflow API** – Some tests mock API responses and need no backend. Tests that hit the real API require the API to be running (see [meshflow-api tests/TESTING.md](../../meshflow-api/tests/TESTING.md) for setup).

3. **Optional: Mapbox token** – Map interaction tests may require `VITE_MAPBOX_TOKEN` in `.env` and a fully loaded map. These tests are skipped automatically when the map canvas is not available.

### Auth bypass

Protected routes normally require authentication. For browser tests, auth is bypassed when the app is built with `VITE_BROWSER_TEST=true`.

- **Implementation**: `ProtectedRoute` checks `import.meta.env.VITE_BROWSER_TEST === 'true'` and, when set, renders children without requiring login.
- **Usage**: The `test:browser:dev` script runs Vite with this env var on port 5174:

  ```bash
  npm run test:browser:dev   # VITE_BROWSER_TEST=true vite --port 5174
  ```

Playwright’s `webServer` config uses `test:browser:dev`, so the dev server started for tests automatically has auth bypass enabled. You can also run `test:browser:dev` manually to develop against protected routes without logging in.

### Running browser tests

```bash
npm run test:browser
```

This will:

1. Start the dev server with `test:browser:dev` (auth bypass on port 5174) if not already running
2. Run all tests in `tests/browser/`

Other commands:

```bash
npm run test:browser:ui       # Playwright UI mode
npm run test:browser:headed   # Run with visible browser window
```

### Test structure

- **Location**: `tests/browser/*.spec.ts`
- **Fixtures**: `tests/browser/fixtures/` – JSON and other test data
- **Page objects**: `tests/browser/pages/` – Page Object Model
- **Config**: `playwright.config.ts` – base URL, web server, timeouts

### Mocking API responses

Tests use `installApiMocks(page)` from `tests/browser/api-mock.ts` to mock all API responses. No live API is required. Tests can mock API calls with `page.route()` so they don’t need a live API:

```typescript
test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});
```

Individual tests can override specific endpoints by passing a second argument:

```typescript
await installApiMocks(page, {
  '**/api/nodes/observed-nodes/**': (route) => route.fulfill({ status: 200, body: JSON.stringify(customData) }),
});
```
