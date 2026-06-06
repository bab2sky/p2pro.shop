-- 종합감사 C3 (Round 6b): seller_grades.seller_id FK 표준화.
--
-- 이전: REFERENCES users(id) — bind 시점엔 user_id 였음.
-- 이후: REFERENCES seller_profiles(id) — order_commission_logs (044) 와 동일 표준.
--
-- 운영 데이터 검증 (2026-05-07):
-- - seller_grades: 1 row, seller_id = sp.user_id 형태로 저장됨.
-- - 매핑 가능: seller_profiles.id 으로 변환 가능 확인.
--
-- 영향:
-- - scheduler 의 INSERT/ON CONFLICT seller_id 경로가 sp.id 키 기반으로 작동.
-- - admin moderation, seller my_grade, products 검색 등 모든 JOIN 단순화.
--
-- 롤백:
--   ALTER TABLE seller_grades DROP CONSTRAINT seller_grades_seller_id_fkey;
--   UPDATE seller_grades SET seller_id = (SELECT user_id FROM seller_profiles WHERE id = seller_grades.seller_id);
--   ALTER TABLE seller_grades ADD CONSTRAINT seller_grades_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id);

-- Step 1: 기존 FK 제거 (UPDATE 가 신규 키 도입 가능하도록)
ALTER TABLE seller_grades
  DROP CONSTRAINT seller_grades_seller_id_fkey;

-- Step 2: 데이터 변환 — user_id → seller_profiles.id
UPDATE seller_grades sg
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = sg.seller_id;

-- Step 3: 매핑 검증 — 안전성 보장
DO $$
DECLARE
  unmapped INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmapped FROM seller_grades
  WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = seller_grades.seller_id);
  IF unmapped > 0 THEN
    RAISE EXCEPTION 'Migration 045 abort: % unmapped seller_id rows in seller_grades', unmapped;
  END IF;
END $$;

-- Step 4: 신규 FK 추가
ALTER TABLE seller_grades
  ADD CONSTRAINT seller_grades_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);
