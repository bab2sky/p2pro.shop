-- 종합감사 M7: 자주 쓰는 쿼리 패턴 인덱스 추가.
--
-- 운영 테이블 현재 모두 매우 작아 (최대 129 row) 인덱스 효과 미미하지만
-- 향후 데이터 증가 시 점진적 효과. 작은 테이블이라 락 시간 ms 단위로
-- CONCURRENTLY 없이 안전.
--
-- 롤백: DROP INDEX <name>;

-- order_commission_logs: 일별/기간별 ledger 조회 (admin/profit 의 platform_summary)
CREATE INDEX IF NOT EXISTS idx_order_commission_logs_created
  ON order_commission_logs(created_at);

-- settlements: 'pending' 정산 필터 (셀러 + 관리자 양쪽 자주 사용)
CREATE INDEX IF NOT EXISTS idx_settlements_status_seller
  ON settlements(status, seller_id);

-- orders: 진행 중 주문 조회 (admin dashboard 카운트, seller orders 페이지)
-- partial index — delivered/confirmed 만 매출 인식이라 그 외 상태는 별도 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at);

-- refund_requests: admin 환불 처리 큐
CREATE INDEX IF NOT EXISTS idx_refund_requests_status_created
  ON refund_requests(status, created_at);

-- notifications: 사용자 미읽음 카운트 (FloatingChat / HeaderActions 빈번 호출)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- products: 카테고리 + active 필터 (메인 카탈로그 페이지)
CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON products(category_id, status)
  WHERE status = 'active';

-- transactions (TXID 검증): 검증 상태 인덱스
CREATE INDEX IF NOT EXISTS idx_transactions_verification
  ON transactions(verification_status, created_at DESC)
  WHERE verification_status IN ('pending', 'failed');

-- chat_rooms: 사용자 활성 채팅 조회
CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer_status
  ON chat_rooms(buyer_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_chat_rooms_seller_status
  ON chat_rooms(seller_id, status)
  WHERE status = 'active';

-- audit_logs: 시간순 admin 활동 조회
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs(created_at DESC);

-- email_logs: 시간순 + 상태 조회
CREATE INDEX IF NOT EXISTS idx_email_logs_status_created
  ON email_logs(status, created_at DESC);

-- product_views: idx_product_views_product (product_id, viewed_at DESC) 이미
-- 마이그레이션 초기에 존재. 추가 인덱스 불필요.
