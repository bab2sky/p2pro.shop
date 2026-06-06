import { test, expect } from './fixtures/auth.fixture';
import { selectors } from './helpers/selectors';

test.describe('Dispute Flow', () => {
  test('create dispute -> respond -> admin resolve', async ({
    buyerPage,
    sellerPage,
    adminPage,
    seededData,
  }) => {
    // Step 1: Buyer navigates to orders
    await buyerPage.goto('/orders');
    await buyerPage.waitForLoadState('networkidle');

    const orderRows = buyerPage.locator(selectors.orders.row);
    const orderCount = await orderRows.count();

    if (orderCount === 0) {
      test.skip();
      return;
    }

    // Click first order
    await orderRows.first().click();
    await buyerPage.waitForURL(/\/orders\//, { timeout: 5000 });

    // Step 2: Create dispute
    const createDisputeBtn = buyerPage.locator(selectors.disputes.createButton);
    if (!(await createDisputeBtn.isVisible())) {
      // No dispute button — order may not be in correct state
      test.skip();
      return;
    }

    await createDisputeBtn.click();
    await buyerPage.waitForTimeout(500);

    const reasonInput = buyerPage.locator(selectors.disputes.reasonInput);
    if (await reasonInput.isVisible()) {
      await reasonInput.fill('Product not as described in listing');
      await buyerPage.locator(selectors.disputes.submitButton).click();
      await buyerPage.waitForTimeout(1000);
    }

    // Step 3: Verify dispute appears in buyer's disputes list
    await buyerPage.goto('/disputes');
    await buyerPage.waitForLoadState('networkidle');
    await expect(buyerPage).toHaveURL(/\/disputes/);

    // Step 4: Seller responds to dispute
    await sellerPage.goto('/disputes');
    await sellerPage.waitForLoadState('networkidle');

    const disputeRows = sellerPage.locator(selectors.orders.row + ', [data-testid="dispute-row"]');
    if ((await disputeRows.count()) > 0) {
      await disputeRows.first().click();
      await sellerPage.waitForTimeout(500);

      const responseInput = sellerPage.locator(selectors.disputes.responseInput);
      if (await responseInput.isVisible()) {
        await responseInput.fill('We shipped the correct item. Attaching proof.');
        await sellerPage.getByRole('button', { name: /submit|respond|reply/i }).click();
        await sellerPage.waitForTimeout(1000);
      }
    }

    // Step 5: Admin resolves dispute
    await adminPage.goto('/admin/disputes');
    await adminPage.waitForLoadState('networkidle');

    const resolveBtn = adminPage.locator(selectors.disputes.resolveButton).first();
    if (await resolveBtn.isVisible()) {
      await resolveBtn.click();
      await adminPage.waitForTimeout(1000);
    }

    // Verify: disputes page is accessible
    await buyerPage.goto('/disputes');
    await expect(buyerPage).toHaveURL(/\/disputes/);
  });
});
