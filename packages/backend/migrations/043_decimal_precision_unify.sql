-- 종합감사 M1: 금액 컬럼 DECIMAL 정밀도 통일.
--
-- 표준: DECIMAL(18,6) — USDT 정밀도 (6자리 소수, 최대 12자리 정수).
--
-- 운영 데이터 검증 (2026-05-07):
-- - withdrawal_requests, refund_requests, coupons, time_deals: 0 row
-- - orders.discount_amount: 10 row 모두 0.00
-- → 정밀도 변경 시 데이터 손실 0건. ALTER COLUMN TYPE 안전.
--
-- 롤백: 이전 정밀도로 ALTER COLUMN TYPE.

-- withdrawal_requests: DECIMAL(20,2) → DECIMAL(18,6)
-- 정수 자리 20 → 12 축소. 운영 0 row 라 안전. USDT 거래에서 12자리 (조 단위) 충분.
ALTER TABLE withdrawal_requests
  ALTER COLUMN amount TYPE DECIMAL(18, 6) USING amount::DECIMAL(18, 6),
  ALTER COLUMN fee_amount TYPE DECIMAL(18, 6) USING fee_amount::DECIMAL(18, 6),
  ALTER COLUMN net_amount TYPE DECIMAL(18, 6) USING net_amount::DECIMAL(18, 6);

-- refund_requests.refund_amount: DECIMAL(18,2) → DECIMAL(18,6)
-- scale 확장 (2 → 6), 무손실.
ALTER TABLE refund_requests
  ALTER COLUMN refund_amount TYPE DECIMAL(18, 6)
  USING refund_amount::DECIMAL(18, 6);

-- orders.discount_amount: NUMERIC(12,2) → DECIMAL(18,6)
-- precision + scale 확장, 무손실.
ALTER TABLE orders
  ALTER COLUMN discount_amount TYPE DECIMAL(18, 6)
  USING discount_amount::DECIMAL(18, 6);

-- coupons: NUMERIC(12,2) → DECIMAL(18,6)
ALTER TABLE coupons
  ALTER COLUMN discount_value TYPE DECIMAL(18, 6) USING discount_value::DECIMAL(18, 6),
  ALTER COLUMN max_discount TYPE DECIMAL(18, 6) USING max_discount::DECIMAL(18, 6),
  ALTER COLUMN min_order_amount TYPE DECIMAL(18, 6) USING min_order_amount::DECIMAL(18, 6);

-- time_deals: DECIMAL(20,8) → DECIMAL(18,6)
-- scale 8 → 6 축소. 운영 0 row 라 안전. 향후 8자리 정밀도가 필요한 토큰
-- 거래 도입 시 별도 컬럼 또는 정밀도 재확장.
ALTER TABLE time_deals
  ALTER COLUMN deal_price TYPE DECIMAL(18, 6) USING deal_price::DECIMAL(18, 6),
  ALTER COLUMN original_price TYPE DECIMAL(18, 6) USING original_price::DECIMAL(18, 6);
