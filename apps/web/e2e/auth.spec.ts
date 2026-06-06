import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  const timestamp = Date.now();
  const testUser = {
    username: `test_user_${timestamp}`,
    email: `test_${timestamp}@e2e.com`,
    password: 'TestPass123!',
    real_name: 'E2E Test User',
  };

  test('signup -> login -> profile', async ({ page }) => {
    // 1. Navigate to register
    await page.goto('/register');
    await expect(page).toHaveURL(/register/);

    // 2. Fill signup form
    await page.fill('input[name="username"]', testUser.username);
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.fill(
      'input[name="passwordConfirm"], input[name="password_confirm"]',
      testUser.password,
    );
    await page.fill('input[name="real_name"], input[name="realName"]', testUser.real_name);

    // 3. Submit
    await page.click('button[type="submit"]');

    // 4. Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 10000 });

    // 5. Login
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // 6. Should redirect to home or dashboard
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
  });

  test('wrong password -> login failure', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', 'WrongPass123!');
    await page.click('button[type="submit"]');

    // Should stay on login page with error
    await expect(page).toHaveURL(/login/);
  });
});
