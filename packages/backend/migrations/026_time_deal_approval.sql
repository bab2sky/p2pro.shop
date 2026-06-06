-- Add approval status to time_deals
-- status: pending (seller created) -> approved (admin approved) -> rejected (admin rejected)
ALTER TABLE time_deals ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE time_deals ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE time_deals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE time_deals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);

-- Update existing active deals to 'approved' status
UPDATE time_deals SET status = 'approved' WHERE is_active = true;
UPDATE time_deals SET status = 'rejected' WHERE is_active = false;

-- Index for admin listing pending deals
CREATE INDEX IF NOT EXISTS idx_time_deals_status ON time_deals (status, created_at DESC);
