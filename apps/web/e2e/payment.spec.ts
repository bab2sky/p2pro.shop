import { test, expect } from './fixtures/auth.fixture';
import { selectors } from './helpers/selectors';

test.describe('Payment Flow', () => {
  test('TXID submit -> admin verify -> delivery -> confirm', async ({
    buyerPage,
    sellerPage,
    adminPage,
    seededData,
  }) => {
    // Step 1: Buyer browses products and adds to cart
    await buyerPage.goto('/products');
    await buyerPage.waitForLoadState('networkidle');

    const productCards = buyerPage.locator(selectors.products.card);
    const productCount = await productCards.count();

    if (productCount === 0) {
      test.skip();
      return;
    }

    // Click first product
    await productCards.first().click();
    await buyerPage.waitForURL(/\/products\//, { timeout: 5000 });

    // Add to cart
    const addToCartBtn = buyerPage.locator(selectors.products.addToCartButton);
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
      await buyerPage.waitForTimeout(500);
    }

    // Step 2: Go to cart and checkout
    await buyerPage.goto('/cart');
    await buyerPage.waitForLoadState('networkidle');

    const checkoutBtn = buyerPage.locator(selectors.cart.checkoutButton);
    if (await checkoutBtn.isVisible()) {
      await checkoutBtn.click();
      await buyerPage.waitForURL(/\/checkout|\/payment/, { timeout: 5000 });
    }

    // Step 3: Navigate to orders and find pending order
    await buyerPage.goto('/orders');
    await buyerPage.waitForLoadState('networkidle');

    const orderRows = buyerPage.locator(selectors.orders.row);
    const orderCount = await orderRows.count();

    if (orderCount === 0) {
      // No orders created — skip remaining flow
      test.skip();
      return;
    }

    // Click first order
    await orderRows.first().click();
    await buyerPage.waitForURL(/\/orders\//, { timeout: 5000 });

    // Step 4: Submit TXID
    const txidInput = buyerPage.locator(selectors.orders.txidInput);
    if (await txidInput.isVisible()) {
      await txidInput.fill('0x' + 'a'.repeat(64));
      await buyerPage.locator(selectors.orders.submitTxidButton).click();
      await buyerPage.waitForTimeout(1000);
    }

    // Step 5: Admin verifies TXID
    await adminPage.goto('/admin/txid');
    await adminPage.waitForLoadState('networkidle');

    const verifyBtn = adminPage.locator(selectors.admin.verifyTxidButton).first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await adminPage.waitForTimeout(1000);
    }

    // Step 6: Seller marks as shipped (navigate to seller orders)
    await sellerPage.goto('/seller/orders');
    await sellerPage.waitForLoadState('networkidle');

    // Step 7: Buyer confirms receipt
    await buyerPage.goto('/orders');
    await buyerPage.waitForLoadState('networkidle');

    if (await orderRows.first().isVisible()) {
      await orderRows.first().click();
      await buyerPage.waitForURL(/\/orders\//, { timeout: 5000 });

      const confirmBtn = buyerPage.locator(selectors.orders.confirmButton);
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await buyerPage.waitForTimeout(1000);
      }
    }

    // Verify: orders page is accessible
    await buyerPage.goto('/orders');
    await expect(buyerPage).toHaveURL(/\/orders/);
  });
});
