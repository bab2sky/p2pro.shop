-- v1.3.0: Make order_commission_logs a proper double-entry ledger.
--
-- Background: order_commission_logs was a dead table; we just started writing snapshot
-- rows on confirm_order. To support refund reversals (negative entries) and to make
-- past-period revenue SUMs immutable, we need to distinguish entry kinds.
--
-- entry_type values (so far):
--   'confirmed_revenue' — written by confirm_order; commission_amount > 0
--   'refund_reversal'   — written by admin refund approve; commission_amount < 0
--
-- Existing rows (none in production yet, only those written by the v1.2.0+ confirm_order
-- patch) are 'confirmed_revenue' — DEFAULT handles backfill.

ALTER TABLE order_commission_logs
    ADD COLUMN IF NOT EXISTS entry_type VARCHAR(30) NOT NULL DEFAULT 'confirmed_revenue';

-- Idempotency / lookup index for "has this order already been reversed?"
CREATE INDEX IF NOT EXISTS idx_order_commission_logs_order_entry
    ON order_commission_logs (order_id, entry_type);
