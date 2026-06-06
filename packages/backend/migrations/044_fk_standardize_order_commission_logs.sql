-- 종합감사 C3 (Round 6a): order_commission_logs.seller_id FK 표준화.
--
-- 이전: REFERENCES users(id) — column 의미가 user_id 였음.
-- 이후: REFERENCES seller_profiles(id) — orders/settlements/products 등과 정합.
--
-- 운영 데이터 검증 (2026-05-07):
-- - order_commission_logs: 1 row, seller_id=23b1... (= seller_profiles.user_id)
-- - 매핑 가능: seller_profiles.id=ff34... 으로 변환
--
-- 영향:
-- - admin/profit.rs 의 cross-FK JOIN 단순화 가능 (별도 commit 에서 코드 변경)
-- - 자동 cross-table 정합성 — refund_map 키 정규화 코드 불필요해짐
--
-- 롤백:
--   ALTER TABLE order_commission_logs DROP CONSTRAINT order_commission_logs_seller_id_fkey;
--   UPDATE order_commission_logs SET seller_id = (SELECT user_id FROM seller_profiles WHERE id = order_commission_logs.seller_id);
--   ALTER TABLE order_commission_logs ADD CONSTRAINT order_commission_logs_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id);

-- Step 1: 기존 FK 제거 (UPDATE 가 신규 키 도입 가능하도록)
ALTER TABLE order_commission_logs
  DROP CONSTRAINT order_commission_logs_seller_id_fkey;

-- Step 2: 데이터 변환 — user_id → seller_profiles.id
-- 매핑되지 않는 row 가 있으면 그대로 유지됨 (다음 검증 단계에서 abort).
UPDATE order_commission_logs ocl
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = ocl.seller_id;

-- Step 3: 매핑 안 된 row 검증 — 안전성 보장
-- (모든 row 가 변환됐다면 검증 쿼리 결과 0)
DO $$
DECLARE
  unmapped INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped FROM order_commission_logs
  WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = order_commission_logs.seller_id);
  IF unmapped > 0 THEN
    RAISE EXCEPTION 'Migration 044 abort: % unmapped seller_id rows in order_commission_logs', unmapped;
  END IF;
END $$;

-- Step 4: 신규 FK 추가
ALTER TABLE order_commission_logs
  ADD CONSTRAINT order_commission_logs_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);
