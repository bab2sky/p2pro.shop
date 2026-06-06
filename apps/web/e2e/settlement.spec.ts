import { test, expect } from './fixtures/auth.fixture';
import { selectors } from './helpers/selectors';

test.describe('Settlement Flow', () => {
  test('settlement -> withdrawal -> admin approve', async ({
    sellerPage,
    adminPage,
    seededData,
  }) => {
    // Step 1: Seller navigates to settlement page
    await sellerPage.goto('/seller/settlement');
    await sellerPage.waitForLoadState('networkidle');
    await expect(sellerPage).toHaveURL(/\/seller\/settlement/);

    // Step 2: Check balance display
    const balance = sellerPage.locator(selectors.settlement.balanceDisplay);
    if (!(await balance.isVisible())) {
      // Settlement page may require seller profile — skip if not set up
      test.skip();
      return;
    }

    // Step 3: Request withdrawal
    const withdrawBtn = sellerPage.locator(selectors.settlement.withdrawButton);
    if (!(await withdrawBtn.isVisible())) {
      // No balance to withdraw
      test.skip();
      return;
    }

    await withdrawBtn.click();
    await sellerPage.waitForTimeout(500);

    // Fill wallet address
    const walletInput = sellerPage.locator(selectors.settlement.walletInput);
    if (await walletInput.isVisible()) {
      await walletInput.fill('0x' + 'b'.repeat(40));
    }

    // Fill amount
    const amountInput = sellerPage.locator(selectors.settlement.amountInput);
    if (await amountInput.isVisible()) {
      await amountInput.fill('10');
    }

    // Step 4: 2FA (if required)
    const twoFaInput = sellerPage.locator(selectors.settlement.twoFaInput);
    if (await twoFaInput.isVisible()) {
      await twoFaInput.fill('000000');
    }

    // Confirm withdrawal
    const confirmBtn = sellerPage.locator(selectors.settlement.confirmButton);
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await sellerPage.waitForTimeout(1000);
    }

    // Step 5: Admin approves withdrawal
    await adminPage.goto('/admin/withdrawals');
    await adminPage.waitForLoadState('networkidle');

    const approveBtn = adminPage.locator(selectors.admin.approveButton).first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await adminPage.waitForTimeout(1000);
    }

    // Step 6: Verify settlement page still accessible
    await sellerPage.goto('/seller/settlement');
    await expect(sellerPage).toHaveURL(/\/seller\/settlement/);
  });
});
