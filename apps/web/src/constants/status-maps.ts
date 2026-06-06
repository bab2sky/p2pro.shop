// ──────────────────────────────────────────────
// Shared status label / color maps
// Extracted from duplicated definitions across admin, seller, and buyer pages.
// ──────────────────────────────────────────────

/** Order status labels (Korean) */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제 대기',
  pending_txid: 'TXID 대기',
  txid_submitted: 'TXID 확인중',
  payment_verified: '결제 완료',
  shipped: '배송 중',
  delivered: '배송 완료',
  confirmed: '구매 확정',
  cancelled: '취소',
  refunded: '환불됨',
};

/** Order status badge colors (Tailwind classes) */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending_txid: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
  txid_submitted: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  payment_verified: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  shipped: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
  delivered: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  confirmed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  cancelled: 'bg-red-50 text-red-500 dark:bg-red-500/10',
  refunded: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
};

/** Order status bar-chart colors (solid Tailwind bg classes for AdminDashboard) */
export const ORDER_STATUS_BAR_COLORS: Record<string, string> = {
  pending_payment: 'bg-gray-200',
  pending_txid: 'bg-amber-400',
  payment_verified: 'bg-emerald-400',
  shipped: 'bg-gray-900',
  delivered: 'bg-emerald-300',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-red-400',
  refunded: 'bg-amber-400',
};

// ── Refund ───────────────────────────────────

/** Refund status labels (buyer / admin perspective) */
export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: '판매자 응답 대기',
  seller_approved: '관리자 처리 대기',
  seller_rejected: '판매자 거절',
  admin_processing: '처리 중',
  admin_completed: '환불 완료',
  admin_rejected: '관리자 거절',
};

/** Refund status badge colors */
export const REFUND_STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
  seller_approved: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  seller_rejected: 'bg-red-50 text-red-500 dark:bg-red-500/10',
  admin_processing: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
  admin_completed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  admin_rejected: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

/** Refund reason labels */
export const REFUND_REASON_LABELS: Record<string, string> = {
  defective: '상품 불량/파손',
  wrong_item: '오배송',
  not_delivered: '상품 미도착',
  not_as_described: '설명 불일치',
  change_of_mind: '단순 변심',
  other: '기타',
};

// ── Dispute ──────────────────────────────────

/** Dispute status labels */
export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: '접수됨',
  responded: '답변 완료',
  under_review: '검토 중',
  resolved: '해결됨',
  closed: '종료',
};

/** Dispute status badge colors */
export const DISPUTE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
  responded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  under_review: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
  resolved: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

/** Dispute type labels */
export const DISPUTE_TYPE_LABELS: Record<string, string> = {
  not_delivered: '미배송',
  defective: '불량/파손',
  wrong_item: '오배송',
  other: '기타',
};
