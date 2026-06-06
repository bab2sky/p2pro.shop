-- 글로벌 진출 D-3: 카테고리 영어명 채우기.
-- 진출 후 신규 카테고리 추가 시 admin UI 에서 name_en 입력 필수 정책 (별도 작업).
--
-- 매핑:
--   NFT       → NFT
--   가전      → Electronics
--   뷰티      → Beauty
--   건강식품  → Health & Wellness
--   생활용품  → Home & Living
--   여행      → Travel
--   AI 솔루션 → AI Solutions

UPDATE categories SET name_en = 'NFT' WHERE slug = 'nft';
UPDATE categories SET name_en = 'Electronics' WHERE name = '가전';
UPDATE categories SET name_en = 'Beauty' WHERE name = '뷰티';
UPDATE categories SET name_en = 'Health & Wellness' WHERE name = '건강식품';
UPDATE categories SET name_en = 'Home & Living' WHERE name = '생활용품';
UPDATE categories SET name_en = 'Travel' WHERE name = '여행';
UPDATE categories SET name_en = 'AI Solutions' WHERE name = 'AI 솔루션';

-- 검증: 누락된 row 가 있으면 RAISE
DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing FROM categories WHERE name_en IS NULL OR name_en = '';
  IF missing > 0 THEN
    RAISE WARNING 'Migration 049: % categories still missing name_en', missing;
  END IF;
END $$;
