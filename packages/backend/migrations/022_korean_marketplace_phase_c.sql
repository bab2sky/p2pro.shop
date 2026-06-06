-- Migration: 022_korean_marketplace_phase_c.sql
-- Phase C: 상품 관리 도구
-- Date: 2026-03-12

-- 1. Product Views (조회수 트래킹)
CREATE TABLE IF NOT EXISTS product_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    ip_hash VARCHAR(64),
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_daily ON product_views(product_id, ((viewed_at AT TIME ZONE 'UTC')::date));

-- 2. Products 할인 확장
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price DECIMAL(20,8);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_starts_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_ends_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_products_discount_active ON products(discount_starts_at, discount_ends_at)
    WHERE discount_price IS NOT NULL;

-- 3. Bulk Upload Logs (대량 등록 이력)
CREATE TABLE IF NOT EXISTS bulk_upload_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id),
    upload_type VARCHAR(20) NOT NULL CHECK (upload_type IN ('create', 'update', 'status', 'price')),
    file_name VARCHAR(500) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    error_details JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'completed', 'failed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_seller ON bulk_upload_logs(seller_id, created_at DESC);
