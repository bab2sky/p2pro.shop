-- 019_udg_reward.sql
-- Phase A: UDG 15-level 보상 연동을 위한 스키마 변경

-- FR-09: orders 테이블에 UDG 이벤트 추적 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS udg_event_sent_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS udg_distribution_id VARCHAR(100);

-- FR-06: UDG 이벤트 발송 후 환불 차단
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_blocked BOOLEAN DEFAULT FALSE;

-- webhook_events 테이블에 order 참조 추가 (조회 최적화)
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_udg_event ON orders(udg_event_sent_at) WHERE udg_event_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_order ON webhook_events(order_id) WHERE order_id IS NOT NULL;

-- Phase B: 쿠폰 카테고리 타겟팅
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS target_categories UUID[] DEFAULT '{}';

-- Phase C: 채팅 이미지 메시지 지원
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_thumbnail TEXT;

-- FR-20: 채팅방 아카이브 상태
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status);
