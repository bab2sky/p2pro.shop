-- v1.3.10 운영 정책: 판매자 USDT 지갑은 한 번 등록하면 변경 불가.
-- 첫 등록 시 wallet_locked = TRUE 로 set 되고, 이후 update_seller_profile
-- 의 wallet_address 변경 path는 WHERE wallet_locked = FALSE 가드를 통해
-- silently rows_affected = 0 으로 거절된다 (UDG/seller 지갑 정책 통일).
--
-- 컬럼이 새로 추가되는 시점에 기존 row 들은 모두 wallet_locked = FALSE 로
-- 시작한다. 그래야 운영자가 admin 경유로 한 번 더 정정할 여지가 남는다.
-- 회원이 한 번 update_seller_profile 로 wallet 을 변경하면 그 시점부터 잠긴다.

ALTER TABLE seller_profiles
    ADD COLUMN IF NOT EXISTS wallet_locked BOOLEAN NOT NULL DEFAULT FALSE;
