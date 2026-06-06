import { test as base, expect, type Page } from '@playwright/test';
import { seedTestData, type SeededData } from './seed-data';

type AuthFixtures = {
  seededData: SeededData;
  buyerPage: Page;
  sellerPage: Page;
  adminPage: Page;
};

/**
 * Extended Playwright test with pre-authenticated pages.
 */
export const test = base.extend<AuthFixtures>({
  seededData: async ({}, use) => {
    const data = await seedTestData();
    await use(data);
  },

  buyerPage: async ({ browser, seededData }, use) => {
    const context = await browser.newContext({
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(seededData.buyer.email);
    await page.getByLabel(/password/i).fill(seededData.buyer.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('/', { timeout: 10000 });
    await use(page);
    await context.close();
  },

  sellerPage: async ({ browser, seededData }, use) => {
    const context = await browser.newContext({
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(seededData.seller.email);
    await page.getByLabel(/password/i).fill(seededData.seller.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('/', { timeout: 10000 });
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser, seededData }, use) => {
    if (!seededData.admin.token) {
      base.skip();
      return;
    }
    const context = await browser.newContext({
      storageState: undefined,
    });
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(seededData.admin.email);
    await page.getByLabel(/password/i).fill(seededData.admin.password);
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL('**/*', { timeout: 10000 });
    await use(page);
    await context.close();
  },
});

export { expect };
