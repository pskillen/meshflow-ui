import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  get recentlyActiveNodesHeading() {
    return this.page.getByRole('heading', { name: 'Right now' });
  }

  get meshflowMapHeading() {
    return this.page.getByText('Meshflow Map');
  }

  get meshStatsHeading() {
    return this.page.getByText('Over the last 7 days');
  }

  get nodesPageLink() {
    return this.page.getByRole('link', { name: /nodes page/i });
  }

  async expectLoaded() {
    await expect(this.recentlyActiveNodesHeading).toBeVisible();
    await expect(this.meshflowMapHeading).toBeVisible();
    await expect(this.meshStatsHeading).toBeVisible();
  }

  async expectNodeCounts(values: (string | number)[]) {
    const section = this.page.getByTestId('right-now-tiles');
    for (const value of values) {
      await expect(section.getByText(String(value), { exact: false }).first()).toBeVisible();
    }
  }

  async clickNodesPageLink() {
    await this.nodesPageLink.click();
  }
}
