/**
 * Common page selectors for E2E tests.
 * Centralizes selectors to reduce duplication and ease maintenance.
 */

export const selectors = {
  // Auth
  auth: {
    emailInput: 'input[name="email"], [data-testid="email-input"]',
    passwordInput: 'input[name="password"], [data-testid="password-input"]',
    loginButton: 'button[type="submit"]',
    signupButton: 'button[type="submit"]',
    usernameInput: 'input[name="username"], [data-testid="username-input"]',
    realNameInput: 'input[name="real_name"], [data-testid="realname-input"]',
  },

  // Navigation
  nav: {
    logo: '[data-testid="logo"], a[href="/"]',
    cartIcon: '[data-testid="cart-icon"], a[href="/cart"]',
    notificationIcon: '[data-testid="notification-icon"]',
    profileMenu: '[data-testid="profile-menu"]',
  },

  // Products
  products: {
    list: '[data-testid="product-list"]',
    card: '[data-testid="product-card"]',
    searchInput: 'input[name="search"], [data-testid="search-input"]',
    addToCartButton: '[data-testid="add-to-cart"]',
    priceDisplay: '[data-testid="product-price"]',
  },

  // Cart
  cart: {
    itemList: '[data-testid="cart-items"]',
    itemRow: '[data-testid="cart-item"]',
    quantityInput: '[data-testid="cart-quantity"]',
    checkoutButton: '[data-testid="checkout-button"]',
    totalDisplay: '[data-testid="cart-total"]',
  },

  // Orders
  orders: {
    list: '[data-testid="order-list"]',
    row: '[data-testid="order-row"]',
    statusBadge: '[data-testid="order-status"]',
    txidInput: '[data-testid="txid-input"]',
    submitTxidButton: '[data-testid="submit-txid"]',
    confirmButton: '[data-testid="confirm-receipt"]',
  },

  // Disputes
  disputes: {
    createButton: '[data-testid="create-dispute"]',
    reasonInput: '[data-testid="dispute-reason"]',
    submitButton: '[data-testid="submit-dispute"]',
    responseInput: '[data-testid="dispute-response"]',
    resolveButton: '[data-testid="resolve-dispute"]',
    statusBadge: '[data-testid="dispute-status"]',
  },

  // Settlement
  settlement: {
    balanceDisplay: '[data-testid="settlement-balance"]',
    withdrawButton: '[data-testid="withdraw-button"]',
    walletInput: '[data-testid="wallet-address"]',
    amountInput: '[data-testid="withdraw-amount"]',
    twoFaInput: '[data-testid="2fa-code"]',
    confirmButton: '[data-testid="confirm-withdraw"]',
    statusBadge: '[data-testid="settlement-status"]',
  },

  // Admin
  admin: {
    sidebar: '[data-testid="admin-sidebar"]',
    verifyTxidButton: '[data-testid="verify-txid"]',
    approveButton: '[data-testid="approve-button"]',
    rejectButton: '[data-testid="reject-button"]',
  },

  // Common
  common: {
    loading: '[data-testid="loading"]',
    toast: '[data-testid="toast"], [role="alert"]',
    modal: '[data-testid="modal"], [role="dialog"]',
    confirmDialog: '[data-testid="confirm-dialog"]',
    pagination: '[data-testid="pagination"]',
  },
} as const;
