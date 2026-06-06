-- Migration: 023_korean_marketplace_phase_d.sql
-- Phase D: 마케팅 + 배송 + 분석
-- Date: 2026-03-12

-- 1. Coupons 확장 (판매자 쿠폰)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES users(id);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type VARCHAR(20) DEFAULT 'platform';
CREATE INDEX IF NOT EXISTS idx_coupons_seller ON coupons(seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_type ON coupons(coupon_type);

-- 2. Regional Surcharges (도서산간 추가배송비)
CREATE TABLE IF NOT EXISTS regional_surcharges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_name VARCHAR(100) NOT NULL,
    zipcode_prefixes VARCHAR(10)[] NOT NULL,
    surcharge DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO regional_surcharges (region_name, zipcode_prefixes, surcharge) VALUES
('제주특별자치도', ARRAY['63'], 3000.00),
('울릉도', ARRAY['799'], 5000.00),
('도서산간 기타', ARRAY['539', '548', '561'], 3000.00)
ON CONFLICT DO NOTHING;

-- 3. Seller Profiles 확장
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS free_shipping_threshold DECIMAL(20,8);
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS avg_response_hours DECIMAL(5,1);
ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS penalty_points INT DEFAULT 0;

-- 4. Exchange Requests (교환 요청)
CREATE TABLE IF NOT EXISTS exchange_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    reason_code VARCHAR(30) NOT NULL CHECK (reason_code IN (
        'wrong_size', 'wrong_color', 'defective', 'wrong_product', 'other'
    )),
    reason_detail TEXT,
    desired_option JSONB,
    status VARCHAR(30) DEFAULT 'requested' CHECK (status IN (
        'requested', 'approved', 'buyer_shipped', 'seller_received',
        'seller_reshipped', 'completed', 'rejected', 'cancelled'
    )),
    return_tracking_number VARCHAR(100),
    return_carrier VARCHAR(50),
    new_tracking_number VARCHAR(100),
    new_carrier VARCHAR(50),
    seller_response TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exchange_order ON exchange_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_exchange_buyer ON exchange_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_exchange_seller ON exchange_requests(seller_id, status);

-- 5. Order Inquiries (주문 문의)
CREATE TABLE IF NOT EXISTS order_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    inquiry_type VARCHAR(30) NOT NULL CHECK (inquiry_type IN (
        'shipping', 'product', 'exchange', 'refund', 'etc'
    )),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'replied', 'resolved', 'escalated'
    )),
    seller_reply TEXT,
    replied_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_inquiries_order ON order_inquiries(order_id);
CREATE INDEX IF NOT EXISTS idx_order_inquiries_buyer ON order_inquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_inquiries_seller ON order_inquiries(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_order_inquiries_pending ON order_inquiries(seller_id, created_at)
    WHERE status = 'pending';

-- 6. Time Deals (타임딜)
CREATE TABLE IF NOT EXISTS time_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id),
    deal_price DECIMAL(20,8) NOT NULL,
    original_price DECIMAL(20,8) NOT NULL,
    max_quantity INT,
    sold_quantity INT DEFAULT 0,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (starts_at < ends_at),
    CHECK (deal_price < original_price)
);
CREATE INDEX IF NOT EXISTS idx_time_deals_active ON time_deals(starts_at, ends_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_time_deals_product ON time_deals(product_id);
