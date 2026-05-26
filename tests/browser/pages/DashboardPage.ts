import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page, '/');
  }

  get recentlyActiveNodesHeading() {
    return this.page.getByText('Recently Active Nodes');
  }

  get meshflowMapHeading() {
    return this.page.getByText('Meshflow Map');
  }

  get meshStatsHeading() {
    return this.page.getByText('Mesh stats');
  }

  get nodesPageLink() {
    return this.page.getByRole('link', { name: /nodes page/i });
  }

  get recentlyActiveNodesTable() {
    return this.recentlyActiveNodesHeading.locator('..').locator('..').locator('table');
  }

  async expectLoaded() {
    await expect(this.recentlyActiveNodesHeading).toBeVisible();
    await expect(this.meshflowMapHeading).toBeVisible();
    await expect(this.meshStatsHeading).toBeVisible();
  }

  async expectNodeCounts(values: (string | number)[]) {
    const section = this.page.getByTestId('dashboard-recently-active-nodes');
    for (const value of values) {
      await expect(section.getByText(String(value), { exact: true })).toBeVisible();
    }
  }

  async clickNodesPageLink() {
    await this.nodesPageLink.click();
  }
}
