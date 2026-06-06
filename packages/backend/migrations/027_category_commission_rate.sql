-- Category commission rate: per-category transaction fee applied to base_price
ALTER TABLE categories ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00;

-- Products: store commission_rate at creation time (snapshot from category)
ALTER TABLE products ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00;

-- Recreate final_price generated column to include commission_rate
-- final_price = base_price * (1 + margin_rate/100 + commission_rate/100)
ALTER TABLE products DROP COLUMN final_price;
ALTER TABLE products ADD COLUMN final_price DECIMAL(18,6) GENERATED ALWAYS AS (base_price * (1 + margin_rate / 100 + commission_rate / 100)) STORED;

-- Recreate index on final_price
DROP INDEX IF EXISTS idx_products_final_price;
CREATE INDEX idx_products_final_price ON products(final_price);
