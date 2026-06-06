-- 종합감사 C3 (Round 6c): 잔여 7개 테이블 seller_id FK 일괄 표준화.
--
-- 대상 (모두 운영 0 row 검증 완료, 2026-05-07):
--   bulk_upload_logs, coupons, daily_seller_stats, exchange_requests,
--   order_inquiries, seller_deposit_submissions, time_deals
--
-- 제외:
--   chat_rooms — buyer_id 와 짝을 이루는 "상대 user_id" 의미라 users(id) 유지가 적절.
--
-- 패턴 (각 테이블 동일):
--   1) DROP CONSTRAINT 기존 FK
--   2) UPDATE seller_id = sp.id (user_id 매칭) — 0 row 면 no-op
--   3) unmapped 검증 — 0 row 보장
--   4) ADD CONSTRAINT 신규 FK → seller_profiles(id)

-- ===========================================================================
-- bulk_upload_logs
ALTER TABLE bulk_upload_logs DROP CONSTRAINT bulk_upload_logs_seller_id_fkey;
UPDATE bulk_upload_logs t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM bulk_upload_logs WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = bulk_upload_logs.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: bulk_upload_logs has % unmapped rows', u; END IF;
END $$;
ALTER TABLE bulk_upload_logs ADD CONSTRAINT bulk_upload_logs_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- coupons
ALTER TABLE coupons DROP CONSTRAINT coupons_seller_id_fkey;
UPDATE coupons t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM coupons WHERE seller_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = coupons.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: coupons has % unmapped rows', u; END IF;
END $$;
ALTER TABLE coupons ADD CONSTRAINT coupons_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- daily_seller_stats
ALTER TABLE daily_seller_stats DROP CONSTRAINT daily_seller_stats_seller_id_fkey;
UPDATE daily_seller_stats t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM daily_seller_stats WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = daily_seller_stats.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: daily_seller_stats has % unmapped rows', u; END IF;
END $$;
ALTER TABLE daily_seller_stats ADD CONSTRAINT daily_seller_stats_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- exchange_requests
ALTER TABLE exchange_requests DROP CONSTRAINT exchange_requests_seller_id_fkey;
UPDATE exchange_requests t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM exchange_requests WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = exchange_requests.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: exchange_requests has % unmapped rows', u; END IF;
END $$;
ALTER TABLE exchange_requests ADD CONSTRAINT exchange_requests_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- order_inquiries
ALTER TABLE order_inquiries DROP CONSTRAINT order_inquiries_seller_id_fkey;
UPDATE order_inquiries t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM order_inquiries WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = order_inquiries.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: order_inquiries has % unmapped rows', u; END IF;
END $$;
ALTER TABLE order_inquiries ADD CONSTRAINT order_inquiries_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- seller_deposit_submissions
ALTER TABLE seller_deposit_submissions DROP CONSTRAINT seller_deposit_submissions_seller_id_fkey;
UPDATE seller_deposit_submissions t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM seller_deposit_submissions WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = seller_deposit_submissions.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: seller_deposit_submissions has % unmapped rows', u; END IF;
END $$;
ALTER TABLE seller_deposit_submissions ADD CONSTRAINT seller_deposit_submissions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);

-- ===========================================================================
-- time_deals
ALTER TABLE time_deals DROP CONSTRAINT time_deals_seller_id_fkey;
UPDATE time_deals t
SET seller_id = sp.id
FROM seller_profiles sp
WHERE sp.user_id = t.seller_id;
DO $$ DECLARE u INTEGER; BEGIN
  SELECT COUNT(*) INTO u FROM time_deals WHERE NOT EXISTS (SELECT 1 FROM seller_profiles WHERE id = time_deals.seller_id);
  IF u > 0 THEN RAISE EXCEPTION 'Migration 046 abort: time_deals has % unmapped rows', u; END IF;
END $$;
ALTER TABLE time_deals ADD CONSTRAINT time_deals_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);
