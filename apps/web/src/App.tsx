import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootLayout } from '@/components/layout/RootLayout';
import { SellerGuard } from '@/components/auth/SellerGuard';
import { AdminGuard } from '@/features/admin';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { DesktopOnlyGuard } from '@/components/auth/DesktopOnlyGuard';
import { ThemeProvider } from '@/features/theme';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { CompareFloatingBar } from '@/components/common/CompareFloatingBar';
import * as Sentry from '@sentry/react';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { lazy, Suspense } from 'react';

// Lazy-loaded layouts for code splitting
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout').then(m => ({ default: m.AdminLayout })));
const SellerLayout = lazy(() => import('@/components/layout/SellerLayout').then(m => ({ default: m.SellerLayout })));
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MyPageLayout } from '@/features/mypage/components/MyPageLayout';

// Phase 2 pages (lazy loaded)
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'));
const CategoryProductsPage = lazy(() => import('@/pages/CategoryProductsPage'));
const ProductListPage = lazy(() => import('@/pages/ProductListPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const PaymentPage = lazy(() => import('@/pages/PaymentPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const SellerApplyPage = lazy(() => import('@/pages/SellerApplyPage'));
const SellerDashboardPage = lazy(() => import('@/pages/SellerDashboardPage'));
const SellerProductsPage = lazy(() => import('@/pages/SellerProductsPage'));
const SellerOrdersPage = lazy(() => import('@/pages/SellerOrdersPage'));
const ProductFormPage = lazy(() => import('@/pages/ProductFormPage'));

// Phase 3 pages (lazy loaded)
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'));
const AdminTxidPage = lazy(() => import('@/pages/admin/AdminTxidPage'));
const AdminSellersPage = lazy(() => import('@/pages/admin/AdminSellersPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage'));
const AdminNoticesPage = lazy(() => import('@/pages/admin/AdminNoticesPage'));
const AdminBannersPage = lazy(() => import('@/pages/admin/AdminBannersPage'));
const AdminFaqPage = lazy(() => import('@/pages/admin/AdminFaqPage'));
const AdminLogsPage = lazy(() => import('@/pages/admin/AdminLogsPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'));

// Phase 4 pages (lazy loaded)
const NoticesPage = lazy(() => import('@/pages/NoticesPage'));
const NoticeDetailPage = lazy(() => import('@/pages/NoticeDetailPage'));
const FaqPage = lazy(() => import('@/pages/FaqPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

// Phase 4-D: Settlement & Seller Center
const SellerSettlementPage = lazy(() => import('@/pages/seller/SellerSettlementPage'));
const SellerStatsPage = lazy(() => import('@/pages/seller/SellerStatsPage'));
const SellerShippingPage = lazy(() => import('@/pages/seller/SellerShippingPage'));
const SellerConfirmPage = lazy(() => import('@/pages/seller/SellerConfirmPage'));
const SellerReviewsPage = lazy(() => import('@/pages/seller/SellerReviewsPage'));
const SellerQnaPage = lazy(() => import('@/pages/seller/SellerQnaPage'));
const SellerSettingsPage = lazy(() => import('@/pages/seller/SellerSettingsPage'));
const SellerOrderDetailPage = lazy(() => import('@/pages/seller/SellerOrderDetailPage'));
const AdminWithdrawalsPage = lazy(() => import('@/pages/admin/AdminWithdrawalsPage'));

// Phase 5 pages (lazy loaded)
// ProfilePage moved to MyPage layout
const DisputesPage = lazy(() => import('@/pages/DisputesPage'));
const DisputeDetailPage = lazy(() => import('@/pages/DisputeDetailPage'));
const SellerProfilePage = lazy(() => import('@/pages/SellerProfilePage'));
const AdminDisputesPage = lazy(() => import('@/pages/admin/AdminDisputesPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

// Phase 9: Password reset
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));

// Phase 7: Error pages
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const TimeDealsPage = lazy(() => import('@/pages/TimeDealsPage'));
const ProductComparisonPage = lazy(() => import('@/pages/ProductComparisonPage'));

// Phase 8 pages (lazy loaded)
const OAuthCallbackPage = lazy(() => import('@/features/oauth/OAuthCallbackPage'));
// MyCouponsPage moved to MyPage layout
const AdminCouponsPage = lazy(() => import('@/pages/admin/AdminCouponsPage'));
const AdminEmailLogsPage = lazy(() => import('@/pages/admin/AdminEmailLogsPage'));
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage'));
const AdminShippingPage = lazy(() => import('@/pages/admin/AdminShippingPage'));
const AdminRefundsPage = lazy(() => import('@/pages/admin/AdminRefundsPage'));
const AdminProfitPage = lazy(() => import('@/pages/admin/AdminProfitPage'));
const AdminChatbotPage = lazy(() => import('@/pages/admin/AdminChatbotPage'));
const AdminTimeDealsPage = lazy(() => import('@/pages/admin/AdminTimeDealsPage'));
const AdminAuditLogPage = lazy(() => import('@/pages/admin/AdminAuditLogPage'));
const SellerRefundsPage = lazy(() => import('@/pages/seller/SellerRefundsPage'));
const SellerCouponsPage = lazy(() => import('@/pages/seller/SellerCouponsPage'));
const SellerBulkPage = lazy(() => import('@/pages/seller/SellerBulkPage'));
const SellerTimeDealsPage = lazy(() => import('@/pages/seller/SellerTimeDealsPage'));
const SellerExchangesPage = lazy(() => import('@/pages/seller/SellerExchangesPage'));
const SellerInquiriesPage = lazy(() => import('@/pages/seller/SellerInquiriesPage'));
const SellerProfitPage = lazy(() => import('@/pages/seller/SellerProfitPage'));
// RefundListPage moved to MyPage layout
const RefundDetailPage = lazy(() => import('@/pages/RefundDetailPage'));
const RefundRequestPage = lazy(() => import('@/pages/RefundRequestPage'));
const ExchangeRequestPage = lazy(() => import('@/pages/ExchangeRequestPage'));
const OrderInquiryRequestPage = lazy(() => import('@/pages/OrderInquiryRequestPage'));

// MyPage enhancement (lazy loaded)
const MyDashboardPage = lazy(() => import('@/pages/my/MyDashboardPage'));
const MyOrdersPage = lazy(() => import('@/pages/my/MyOrdersPage'));
const MyOrderDetailPage = lazy(() => import('@/pages/my/MyOrderDetailPage'));
const MyRefundsPage = lazy(() => import('@/pages/my/MyRefundsPage'));
const MyAddressesPage = lazy(() => import('@/pages/my/MyAddressesPage'));
const MyMyCouponsPage = lazy(() => import('@/pages/my/MyCouponsPage'));
const MyWishlistPage = lazy(() => import('@/pages/my/MyWishlistPage'));
const MySettingsPage = lazy(() => import('@/pages/my/MySettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const Loading = () => <div className="text-center py-12 text-gray-500" role="status" aria-label="페이지 로딩 중">Loading...</div>;

/** Redirect /orders/:id → /my/orders/:id preserving actual param */
function OrderIdRedirect() {
  const { id } = useParams();
  return <Navigate to={`/my/orders/${id}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <Sentry.ErrorBoundary fallback={({ error }) => (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
              <h1 className="text-8xl font-bold text-gray-200">500</h1>
              <p className="mt-4 text-lg text-gray-600">문제가 발생했습니다.</p>
              {import.meta.env.DEV && (
                <p className="mt-2 text-sm text-gray-400">{(error as Error)?.message}</p>
              )}
              <button onClick={() => window.location.reload()} className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100">다시 시도하기</button>
            </div>
          )}>
            <Suspense fallback={<Loading />}>
              <Routes>
                {/* Auth pages — no header/footer */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                {/* Standalone pages — no header/footer, own SimplePageHeader */}
                <Route path="/seller/apply" element={<AuthGuard />}>
                  <Route index element={<SellerApplyPage />} />
                </Route>
                <Route path="/notices" element={<NoticesPage />} />
                <Route path="/notices/:id" element={<NoticeDetailPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/faq" element={<FaqPage />} />

                <Route element={<RootLayout />}>
                  {/* 운영 정책 — 폐쇄몰: RootLayout 안의 모든 카탈로그/상점
                     페이지는 로그인 회원에게만 노출한다. 비로그인 사용자는
                     AuthGuard 가 /login 으로 리다이렉트.
                     예외(공개 유지): /login, /register, /forgot-password,
                     /reset-password, /notices, /contact, /about, /terms,
                     /privacy, /faq — 이들은 RootLayout 밖에서 별도 정의됨. */}
                  <Route element={<AuthGuard />}>
                    <Route path="/" element={<HomePage />} />

                    {/* Categories */}
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/categories/:id" element={<CategoryProductsPage />} />

                    {/* Products */}
                    <Route path="/products" element={<ProductListPage />} />
                    <Route path="/time-deals" element={<TimeDealsPage />} />
                    <Route path="/products/:id" element={<ProductDetailPage />} />
                    <Route path="/compare" element={<ProductComparisonPage />} />

                    {/* Cart & Checkout */}
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<ErrorBoundary><CheckoutPage /></ErrorBoundary>} />
                    <Route path="/payment/:id" element={<ErrorBoundary><PaymentPage /></ErrorBoundary>} />

                    {/* Notifications */}
                    <Route path="/notifications" element={<NotificationsPage />} />

                    {/* Chat */}
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/chat/:id" element={<ChatPage />} />

                    {/* Disputes */}
                    <Route path="/disputes" element={<DisputesPage />} />
                    <Route path="/disputes/:id" element={<DisputeDetailPage />} />

                    {/* Refund / Exchange / Inquiry (needs order context) */}
                    <Route path="/orders/:id/refund" element={<RefundRequestPage />} />
                    <Route path="/orders/:id/exchange" element={<ExchangeRequestPage />} />
                    <Route path="/orders/:id/inquiry" element={<OrderInquiryRequestPage />} />
                    <Route path="/refunds/:id" element={<RefundDetailPage />} />

                    {/* Legacy redirects → /my/* */}
                    <Route path="/orders" element={<Navigate to="/my/orders" replace />} />
                    <Route path="/orders/:id" element={<OrderIdRedirect />} />
                    <Route path="/profile" element={<Navigate to="/my/settings" replace />} />
                    <Route path="/wishlist" element={<Navigate to="/my/wishlist" replace />} />
                    <Route path="/addresses" element={<Navigate to="/my/addresses" replace />} />
                    <Route path="/coupons" element={<Navigate to="/my/coupons" replace />} />
                    <Route path="/refunds" element={<Navigate to="/my/refunds" replace />} />

                    {/* Seller profile (closed-mall) */}
                    <Route path="/sellers/:id" element={<SellerProfilePage />} />
                  </Route>

                  {/* OAuth callback — 인증 흐름의 종착점이라 AuthGuard 밖. */}
                  <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

                  {/* 404 — RootLayout 안에 두되 누구나 보이도록 AuthGuard 밖 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* MyPage (separate layout with sidebar, auth required) */}
                <Route element={<RootLayout />}>
                  <Route element={<AuthGuard />}>
                    <Route element={<MyPageLayout />}>
                      <Route path="/my" element={<MyDashboardPage />} />
                      <Route path="/my/orders" element={<MyOrdersPage />} />
                      <Route path="/my/orders/:id" element={<ErrorBoundary><MyOrderDetailPage /></ErrorBoundary>} />
                      <Route path="/my/refunds" element={<MyRefundsPage />} />
                      <Route path="/my/addresses" element={<MyAddressesPage />} />
                      <Route path="/my/coupons" element={<MyMyCouponsPage />} />
                      <Route path="/my/wishlist" element={<MyWishlistPage />} />
                      <Route path="/my/settings" element={<MySettingsPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* Seller Center (separate layout with sidebar, seller-only) */}
                <Route element={<AuthGuard />}>
                  <Route element={<SellerGuard />}>
                    <Route element={<DesktopOnlyGuard><SellerLayout /></DesktopOnlyGuard>}>
                      <Route path="/seller/dashboard" element={<SellerDashboardPage />} />
                      <Route path="/seller/products" element={<SellerProductsPage />} />
                      <Route path="/seller/products/new" element={<ProductFormPage />} />
                      <Route path="/seller/products/:id/edit" element={<ProductFormPage />} />
                      <Route path="/seller/orders" element={<SellerOrdersPage />} />
                      <Route path="/seller/orders/:id" element={<SellerOrderDetailPage />} />
                      <Route path="/seller/orders/shipping" element={<SellerShippingPage />} />
                      <Route path="/seller/orders/confirm" element={<SellerConfirmPage />} />
                      <Route path="/seller/reviews" element={<SellerReviewsPage />} />
                      <Route path="/seller/qna" element={<SellerQnaPage />} />
                      <Route path="/seller/settlement" element={<SellerSettlementPage />} />
                      <Route path="/seller/stats" element={<SellerStatsPage />} />
                      <Route path="/seller/refunds" element={<SellerRefundsPage />} />
                      <Route path="/seller/bulk" element={<SellerBulkPage />} />
                      <Route path="/seller/coupons" element={<SellerCouponsPage />} />
                      <Route path="/seller/timedeals" element={<SellerTimeDealsPage />} />
                      <Route path="/seller/exchanges" element={<SellerExchangesPage />} />
                      <Route path="/seller/inquiries" element={<SellerInquiriesPage />} />
                      <Route path="/seller/profit" element={<SellerProfitPage />} />
                      <Route path="/seller/settings" element={<SellerSettingsPage />} />
                    </Route>
                  </Route>
                </Route>

                {/* Phase 3: Admin (separate layout, no RootLayout header/footer) */}
                <Route
                  element={
                    <AdminGuard>
                      <DesktopOnlyGuard>
                        <AdminLayout />
                      </DesktopOnlyGuard>
                    </AdminGuard>
                  }
                >
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/products" element={<AdminProductsPage />} />
                  <Route path="/admin/txid" element={<AdminTxidPage />} />
                  <Route path="/admin/sellers" element={<AdminSellersPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                  <Route path="/admin/notices" element={<AdminNoticesPage />} />
                  <Route path="/admin/banners" element={<AdminBannersPage />} />
                  <Route path="/admin/faq" element={<AdminFaqPage />} />
                  <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
                  <Route path="/admin/disputes" element={<AdminDisputesPage />} />
                  <Route path="/admin/logs" element={<AdminLogsPage />} />
                  <Route path="/admin/coupons" element={<AdminCouponsPage />} />
                  <Route path="/admin/reviews" element={<AdminReviewsPage />} />
                  <Route path="/admin/shipping" element={<AdminShippingPage />} />
                  <Route path="/admin/refunds" element={<AdminRefundsPage />} />
                  <Route path="/admin/profit" element={<AdminProfitPage />} />
                  <Route path="/admin/email-logs" element={<AdminEmailLogsPage />} />
                  <Route path="/admin/chatbot" element={<AdminChatbotPage />} />
                  <Route path="/admin/timedeals" element={<AdminTimeDealsPage />} />
                  <Route path="/admin/audit-logs" element={<AdminAuditLogPage />} />
                  <Route path="/admin/settings" element={<AdminSettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </Sentry.ErrorBoundary>
          <CompareFloatingBar />
          <InstallPrompt />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
