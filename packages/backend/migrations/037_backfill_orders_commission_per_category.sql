-- v1.2.0: Backfill orders.commission_rate / commission_amount with the per-category rate
--
-- Migration 024 previously backfilled commission as `margin_amount × global_rate / 100`,
-- which (a) used a single global rate ignoring categories and (b) used margin_amount as the base
-- instead of total_amount. The user's intended business rule is:
--   commission_amount = total_amount × commission_rate / 100   (per-category)
--   seller settlement = total_amount - commission_amount
--
-- For each existing order:
--   1. Set commission_rate to the rate of the dominant order item's product (highest subtotal).
--   2. Recompute commission_amount = total_amount × commission_rate / 100.
--   3. Recompute net_profit = margin_amount - commission_amount.

UPDATE orders o
SET commission_rate = sub.commission_rate
FROM (
    SELECT DISTINCT ON (oi.order_id) oi.order_id, p.commission_rate
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    ORDER BY oi.order_id, oi.subtotal DESC NULLS LAST
) sub
WHERE o.id = sub.order_id;

-- Fallback: orders whose order_items have no joinable product (e.g., deleted product)
-- get the global system-settings rate or 5.00 default.
UPDATE orders
SET commission_rate = COALESCE(
        (SELECT CAST(value AS DECIMAL(5,2)) FROM system_settings WHERE key = 'commission_rate'),
        5.00
    )
WHERE commission_rate IS NULL;

-- Recompute commission_amount and net_profit for all orders using the new formula.
UPDATE orders
SET commission_amount = total_amount * commission_rate / 100,
    net_profit = margin_amount - (total_amount * commission_rate / 100);
