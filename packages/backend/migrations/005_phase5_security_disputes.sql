-- Phase 5: Security (TOTP, Wallets), Disputes, Webhook Events, Seller Grades
-- Date: 2026-03-07

-- 1. user_totp: TOTP 2FA secrets and backup codes
CREATE TABLE IF NOT EXISTS user_totp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- argon2-hashed backup codes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_totp_user ON user_totp(user_id);

-- 2. user_wallets: USDT wallet addresses
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL DEFAULT 'default',
  network VARCHAR(20) NOT NULL CHECK (network IN ('ERC20', 'TRC20')),
  address VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, network, address)
);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user ON user_wallets(user_id);

-- disputes table already created in 001_initial_schema.sql

-- 4. dispute_messages: conversation thread for disputes
CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('buyer', 'seller', 'admin')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id, created_at);

-- 5. webhook_events: webhook queue with retry tracking
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dlq')),
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type, created_at DESC);

-- 6. seller_grades: 5-level grade system
CREATE TABLE IF NOT EXISTS seller_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL UNIQUE REFERENCES users(id),
  grade VARCHAR(20) NOT NULL DEFAULT 'bronze' CHECK (grade IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  score DECIMAL(8,2) DEFAULT 0,
  total_sales INT DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  response_rate DECIMAL(5,2) DEFAULT 0,
  dispute_rate DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seller_grades_seller ON seller_grades(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_grades_grade ON seller_grades(grade);

-- 7. ALTER users table: profile image, notification settings, account status
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"order": true, "chat": true, "shipping": true, "notice": true}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'deactivating', 'deleted'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_requested_at TIMESTAMPTZ;

-- 8. ALTER orders table: dispute reference
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id);
