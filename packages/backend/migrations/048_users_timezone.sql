-- 글로벌 진출 D-3 (2026-05-07): users 테이블에 timezone 컬럼 추가.
--
-- 효과:
-- - 향후 사용자별 알림 발송 시각 (예: "매일 09:00 알림") 적용 시 사용자 timezone 기준
-- - 사용자 화면 표시는 여전히 브라우저 timezone 자동 인식 (Intl.DateTimeFormat)
--   이 컬럼은 backend-driven 시각 표시 (이메일, 푸시 알림 등) 가 도입될 때 사용
--
-- 기본값:
-- - 'Asia/Seoul' — 본사 한국 사용자 가정. 진출 후 IP geolocation 또는
--   브라우저 detection 으로 변경 가능 (별도 endpoint).
--
-- IANA timezone 식별자 (예: 'Asia/Seoul', 'America/New_York', 'Europe/London') 사용.

ALTER TABLE users
  ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul';

-- 검증은 application 레이어에서 (CHECK 절은 subquery 불가).
-- pg_timezone_names 시스템 뷰 와 application 비교 권장.
-- 인덱스 불필요 — timezone 으로 WHERE 검색하는 케이스 없음.
