import { ApiHelper } from '../helpers/api-client';

export interface SeededData {
  buyer: { email: string; password: string; token: string };
  seller: { email: string; password: string; token: string };
  admin: { email: string; password: string; token: string };
}

const api = new ApiHelper();

/**
 * Seed test users for E2E tests.
 * Called from globalSetup or individual test suites.
 */
export async function seedTestData(): Promise<SeededData> {
  const timestamp = Date.now();

  // Create buyer
  const buyerEmail = `buyer-${timestamp}@test.com`;
  const buyerPassword = 'BuyerPass1!';
  await api.signup({
    username: `buyer${timestamp}`,
    email: buyerEmail,
    password: buyerPassword,
    real_name: 'Test Buyer',
  });
  const buyerLogin = await api.login(buyerEmail, buyerPassword);
  const buyerToken = buyerLogin.data?.access_token || '';

  // Create seller
  const sellerEmail = `seller-${timestamp}@test.com`;
  const sellerPassword = 'SellerPass1!';
  await api.signup({
    username: `seller${timestamp}`,
    email: sellerEmail,
    password: sellerPassword,
    real_name: 'Test Seller',
  });
  const sellerLogin = await api.login(sellerEmail, sellerPassword);
  const sellerToken = sellerLogin.data?.access_token || '';

  // Admin user (pre-seeded in DB migration, login only)
  const adminEmail = 'admin@p2pro.store';
  const adminPassword = 'AdminPass1!';
  let adminToken = '';
  try {
    const adminLogin = await api.login(adminEmail, adminPassword);
    adminToken = adminLogin.data?.access_token || '';
  } catch {
    // Admin may not exist in test DB — tests that need admin will skip
  }

  return {
    buyer: { email: buyerEmail, password: buyerPassword, token: buyerToken },
    seller: { email: sellerEmail, password: sellerPassword, token: sellerToken },
    admin: { email: adminEmail, password: adminPassword, token: adminToken },
  };
}
