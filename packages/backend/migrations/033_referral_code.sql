-- Add 8-digit numeric referral code column to users table
ALTER TABLE users ADD COLUMN referral_code VARCHAR(8) UNIQUE;

-- Generate codes for existing users
UPDATE users SET referral_code = LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0') WHERE referral_code IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL;

-- Index for fast lookups
CREATE INDEX idx_users_referral_code ON users (referral_code);
