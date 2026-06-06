-- Migration 014: Withdrawal management enhancements
-- Adds txid tracking, completion flow, fee recording, seller name join support

-- Add columns for completion tracking and fee recording
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS txid VARCHAR(100);
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(20,2) DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS net_amount DECIMAL(20,2) DEFAULT 0;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS admin_memo TEXT;

-- Update CHECK constraint to include 'completed' and 'cancelled' statuses
ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
    CHECK (status IN ('pending', 'approved', 'completed', 'rejected', 'cancelled'));

-- Index for completion tracking
CREATE INDEX IF NOT EXISTS idx_withdrawal_completed ON withdrawal_requests (completed_at DESC) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_withdrawal_txid ON withdrawal_requests (txid) WHERE txid IS NOT NULL;
