-- ============================================================
-- Phase 7: Performance Indexes
-- ============================================================

-- 1. 주문: 상태 + 생성일 복합 인덱스 (상태별 최신순 조회)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON orders(status, created_at DESC);

-- 2. 주문: 구매자 + 상태 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
    ON orders(buyer_id, status);

-- 3. 주문: 판매자 + 상태 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_seller_status
    ON orders(seller_id, status);

-- 4. 정산: 판매자 + 상태 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_settlements_seller_status
    ON settlements(seller_id, status);

-- 5. 상품: 승인된 상품 최신순 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_products_approved_created
    ON products(created_at DESC) WHERE status = 'approved';

-- 6. 리뷰: 상품별 최신 리뷰
CREATE INDEX IF NOT EXISTS idx_reviews_product_created
    ON reviews(product_id, created_at DESC);

-- 7. chat_messages: 채팅방별 메시지 목록
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
    ON chat_messages(room_id, created_at DESC);

-- 8. chat_messages: 미읽음 카운트
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
    ON chat_messages(room_id, sender_id) WHERE is_read = false;

-- 9. transactions: 관리자 TXID 검증 대기 큐
CREATE INDEX IF NOT EXISTS idx_transactions_pending_verify
    ON transactions(submitted_at ASC) WHERE verification_status = 'pending';

-- 10. refresh_tokens: 만료 토큰 정리용 (expires_at 단순 인덱스)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON refresh_tokens(expires_at);
