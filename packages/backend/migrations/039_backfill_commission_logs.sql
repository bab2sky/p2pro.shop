-- v1.3.0: Backfill order_commission_logs from historical orders + refund_requests
-- so that admin profit reports (now reading from this ledger) don't show "0 history"
-- after migration 038 made the ledger writable.
--
-- Two passes:
--   (1) Every order that's already past confirm (status in 'confirmed' OR 'refunded')
--       gets a 'confirmed_revenue' row using confirmed_at (or updated_at) as the
--       synthetic ledger timestamp.
--   (2) Every completed refund (refund_requests.status='admin_completed') gets a
--       proportional 'refund_reversal' row using r.processed_at as the timestamp.
--
-- Idempotent via NOT EXISTS guards on (order_id, entry_type).

-- (1) confirmed_revenue backfill
INSERT INTO order_commission_logs
    (order_id, seller_id, entry_type, order_amount, commission_rate, commission_amount, net_amount, created_at)
SELECT o.id, sp.user_id, 'confirmed_revenue',
       o.total_amount,
       COALESCE(o.commission_rate, 0),
       COALESCE(o.commission_amount, 0),
       o.total_amount - COALESCE(o.commission_amount, 0),
       COALESCE(o.confirmed_at, o.updated_at, NOW())
FROM orders o
JOIN seller_profiles sp ON sp.id = o.seller_id
WHERE o.status IN ('confirmed', 'refunded')
  AND NOT EXISTS (
      SELECT 1 FROM order_commission_logs ocl
      WHERE ocl.order_id = o.id AND ocl.entry_type = 'confirmed_revenue'
  );

-- (2) refund_reversal backfill
INSERT INTO order_commission_logs
    (order_id, seller_id, entry_type, order_amount, commission_rate, commission_amount, net_amount, created_at)
SELECT o.id, sp.user_id, 'refund_reversal',
       -COALESCE(r.refund_amount, 0),
       COALESCE(o.commission_rate, 0),
       -(COALESCE(o.commission_amount, 0) * COALESCE(r.refund_amount, 0) / NULLIF(o.total_amount, 0)),
       -(COALESCE(r.refund_amount, 0) - (COALESCE(o.commission_amount, 0) * COALESCE(r.refund_amount, 0) / NULLIF(o.total_amount, 0))),
       COALESCE(r.processed_at, r.updated_at, NOW())
FROM refund_requests r
JOIN orders o ON o.id = r.order_id
JOIN seller_profiles sp ON sp.id = o.seller_id
WHERE r.status = 'admin_completed'
  AND NOT EXISTS (
      SELECT 1 FROM order_commission_logs ocl
      WHERE ocl.order_id = o.id AND ocl.entry_type = 'refund_reversal'
  );
