-- v1.2.0: Option 1 — Remove commission_rate from final_price formula
-- Buyer-facing price now reflects only the seller's intended margin.
-- Commission is deducted at settlement-time only (settlement.rs:calculate_seller_balance),
-- not added on top of the displayed price.
--
-- Before: final_price = base_price * (1 + margin_rate/100 + commission_rate/100)
-- After:  final_price = base_price * (1 + margin_rate/100)

ALTER TABLE products DROP COLUMN final_price;
ALTER TABLE products
    ADD COLUMN final_price DECIMAL(18,6)
    GENERATED ALWAYS AS (base_price * (1 + margin_rate / 100)) STORED;

DROP INDEX IF EXISTS idx_products_final_price;
CREATE INDEX idx_products_final_price ON products(final_price);
