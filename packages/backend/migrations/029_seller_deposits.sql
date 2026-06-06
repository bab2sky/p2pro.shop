-- Seller deposit submissions table
CREATE TABLE IF NOT EXISTS seller_deposit_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id),
    txid VARCHAR(128) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    network VARCHAR(20) NOT NULL DEFAULT 'trc20',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_deposits_seller ON seller_deposit_submissions(seller_id);
CREATE INDEX idx_seller_deposits_status ON seller_deposit_submissions(status);
