-- Migration: 018_refund_requests.sql
-- Feature: payment-refund (환불 기능)

CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES seller_profiles(id),

    -- Refund details
    reason_code VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    evidence_images JSONB DEFAULT '[]'::jsonb,

    -- Status flow: requested → seller_approved/seller_rejected → admin_processing → admin_completed/admin_rejected
    status VARCHAR(30) NOT NULL DEFAULT 'requested',

    -- Seller response
    seller_response VARCHAR(10),
    seller_reason TEXT,
    seller_responded_at TIMESTAMPTZ,

    -- Admin processing
    refund_type VARCHAR(10),
    refund_amount DECIMAL(18,2),
    admin_note TEXT,
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One refund per order
    CONSTRAINT unique_order_refund UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_buyer ON refund_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_seller ON refund_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created ON refund_requests(created_at DESC);
