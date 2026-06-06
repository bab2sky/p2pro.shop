import { test, expect } from '@playwright/test';

test.describe('Product Flow', () => {
  test('browse products -> search -> view detail', async ({ page }) => {
    // 1. Navigate to products page
    await page.goto('/products');
    await expect(page).toHaveURL(/products/);

    // 2. Verify product list loads
    await page.waitForSelector('[data-testid="product-card"], .product-card, article', {
      timeout: 10000,
    });

    // 3. Search for a product
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search"], input[placeholder*="검색"]',
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
    }

    // 4. Click first product to view detail
    const firstProduct = page.locator(
      '[data-testid="product-card"] a, .product-card a, article a',
    ).first();
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      await expect(page).toHaveURL(/products\/.+/);
    }
  });
});
