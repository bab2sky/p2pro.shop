-- Phase 8: Delivery Tracking + Email Notifications

-- Delivery tracking
CREATE TABLE IF NOT EXISTS delivery_trackings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier_code VARCHAR(20) NOT NULL,
    carrier_name VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'in_transit'
        CHECK (status IN ('in_transit', 'out_for_delivery', 'delivered', 'exception')),
    last_detail TEXT,
    last_checked_at TIMESTAMPTZ,
    estimated_delivery TIMESTAMPTZ,
    tracking_events JSONB DEFAULT '[]'::jsonb,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_active ON delivery_trackings(status) WHERE status NOT IN ('delivered', 'exception');
CREATE INDEX IF NOT EXISTS idx_delivery_order ON delivery_trackings(order_id);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_to VARCHAR(255) NOT NULL,
    template_key VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    error_message TEXT,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_pending ON email_logs(status) WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS idx_email_user ON email_logs(user_id);

-- User email preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_order BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_payment BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_delivery BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_settlement BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_dispute BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notify_marketing BOOLEAN NOT NULL DEFAULT false;

-- Add verified_at to transactions (for auto-verify tracking)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
