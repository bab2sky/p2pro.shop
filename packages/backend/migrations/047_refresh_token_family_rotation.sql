-- Round 7: Refresh token family rotation 도입.
--
-- 배경 (Audit Security L-9):
--   현재 단일 토큰 rotation 만 있어 토큰 도난 탐지 불가.
--   공격자가 R1 훔쳐서 먼저 refresh → 정상 사용자는 그냥 로그아웃됨.
--
-- 해결:
--   1) family_id: 같은 로그인 세션에서 발급된 토큰 chain 식별자.
--   2) used_at: 토큰 사용 여부 (단일 사용 강제).
--   3) refresh 시 사용된 (used_at IS NOT NULL) 토큰 재요청 → 도난 감지 → family 전체 무효화.
--
-- Backward compatibility:
--   기존 refresh_tokens row 들은 family_id NULL → 첫 refresh 시 새 family 부여.
--   used_at NULL = 사용 안 됨 (현 상태와 동일).

ALTER TABLE refresh_tokens
  ADD COLUMN family_id UUID,
  ADD COLUMN used_at TIMESTAMPTZ;

-- 기존 토큰들 각각 별도 family 부여 (legacy migration).
-- 새 family 식별자 없으면 도난 감지 로직이 작동 안 하므로.
UPDATE refresh_tokens SET family_id = gen_random_uuid() WHERE family_id IS NULL;

-- 이후 row 는 NOT NULL 강제.
ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;

-- 도난 감지 쿼리 (used_at IS NOT NULL 체크) 가속화.
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user_family ON refresh_tokens(user_id, family_id);
