-- Performance indexes for products, orders queries

-- Partial index for active products (used by product listing/search)
CREATE INDEX IF NOT EXISTS idx_products_active
    ON products (category_id, created_at DESC) WHERE status = 'active';

-- Buyer order listing index
CREATE INDEX IF NOT EXISTS idx_orders_buyer
    ON orders (buyer_id, created_at DESC);

-- Seller order listing index
CREATE INDEX IF NOT EXISTS idx_orders_seller
    ON orders (seller_id, created_at DESC);

-- Order status filtering index
CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders (status, created_at DESC);
