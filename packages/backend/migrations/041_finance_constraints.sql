-- 종합감사 M2 + M3: 금액 컬럼 CHECK constraint 추가.
--
-- 운영 데이터 검증 결과 (2026-05-07): 모든 금액 컬럼에서 음수/NULL 위반 0건.
-- CHECK constraint 추가가 안전하며 향후 코드 버그로 음수 금액 INSERT 되는 것 차단.
--
-- 정책:
-- - 금액 = 0 도 가능 (마진 0% 상품 등)
-- - 출금 amount > 0 (0 출금은 의미 없음)
-- - 환불 refund_amount NULL 가능 (거부 상태)
--
-- 롤백: ALTER TABLE <name> DROP CONSTRAINT <constraint_name>;

-- orders: 매출/마진/배송비/수수료 모두 음수 불가
ALTER TABLE orders
  ADD CONSTRAINT orders_total_amount_nonneg CHECK (total_amount >= 0),
  ADD CONSTRAINT orders_margin_amount_nonneg CHECK (margin_amount >= 0),
  ADD CONSTRAINT orders_shipping_fee_nonneg CHECK (shipping_fee >= 0),
  ADD CONSTRAINT orders_commission_amount_nonneg
    CHECK (commission_amount IS NULL OR commission_amount >= 0);

-- withdrawal_requests: amount > 0 (의미 있는 출금만)
ALTER TABLE withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT withdrawal_requests_fee_amount_nonneg CHECK (fee_amount >= 0);

-- settlements: amount/fee/net 모두 음수 불가
ALTER TABLE settlements
  ADD CONSTRAINT settlements_amount_nonneg CHECK (amount >= 0),
  ADD CONSTRAINT settlements_fee_amount_nonneg CHECK (fee_amount >= 0),
  ADD CONSTRAINT settlements_net_amount_nonneg CHECK (net_amount >= 0);

-- refund_requests: refund_amount 가 채워진 경우 음수 불가
ALTER TABLE refund_requests
  ADD CONSTRAINT refund_requests_refund_amount_nonneg
    CHECK (refund_amount IS NULL OR refund_amount >= 0);

-- order_commission_logs: 비율은 음수 불가, 그러나 amount 컬럼들은
-- entry_type='refund_reversal' 시 음수 entry (환불 차감 회계 표현) 가
-- 정상이므로 CHECK 미적용. commission_rate 만 보호.
ALTER TABLE order_commission_logs
  ADD CONSTRAINT occl_commission_rate_nonneg CHECK (commission_rate >= 0);
