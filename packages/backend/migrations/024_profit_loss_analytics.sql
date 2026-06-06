-- Migration: 024_profit_loss_analytics.sql
-- 손익 분석 데이터 인프라

-- 1. orders 테이블에 수수료/순이익 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(18,6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS net_profit DECIMAL(18,6);

-- 기존 confirmed/delivered/shipped 주문에 commission 백필
UPDATE orders
SET commission_rate = COALESCE(
        (SELECT CAST(value AS DECIMAL(5,2)) FROM system_settings WHERE key = 'commission_rate'),
        5.0
    ),
    commission_amount = margin_amount * COALESCE(
        (SELECT CAST(value AS DECIMAL(5,2)) FROM system_settings WHERE key = 'commission_rate'),
        5.0
    ) / 100,
    net_profit = margin_amount - (margin_amount * COALESCE(
        (SELECT CAST(value AS DECIMAL(5,2)) FROM system_settings WHERE key = 'commission_rate'),
        5.0
    ) / 100)
WHERE status IN ('confirmed', 'delivered', 'shipped')
  AND commission_amount IS NULL;

-- 2. 주문별 수수료 감사 로그
CREATE TABLE IF NOT EXISTS order_commission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id),
    order_amount DECIMAL(18,6) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(18,6) NOT NULL,
    net_amount DECIMAL(18,6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_commission_logs_seller ON order_commission_logs(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_commission_logs_order ON order_commission_logs(order_id);

-- 3. 일별 판매자 집계 테이블
CREATE TABLE IF NOT EXISTS daily_seller_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id),
    stat_date DATE NOT NULL,
    total_orders INT DEFAULT 0,
    gross_sales DECIMAL(18,6) DEFAULT 0,
    total_margin DECIMAL(18,6) DEFAULT 0,
    total_commission DECIMAL(18,6) DEFAULT 0,
    total_shipping_cost DECIMAL(18,6) DEFAULT 0,
    total_refunds DECIMAL(18,6) DEFAULT 0,
    total_coupon_discount DECIMAL(18,6) DEFAULT 0,
    net_profit DECIMAL(18,6) DEFAULT 0,
    refund_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(seller_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_seller_stats_date ON daily_seller_stats(stat_date);

-- 4. 일별 플랫폼 집계 테이블 (관리자용)
CREATE TABLE IF NOT EXISTS daily_platform_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    total_gmv DECIMAL(18,6) DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_commission_income DECIMAL(18,6) DEFAULT 0,
    total_withdrawal_fees DECIMAL(18,6) DEFAULT 0,
    total_refunds DECIMAL(18,6) DEFAULT 0,
    total_new_users INT DEFAULT 0,
    total_new_sellers INT DEFAULT 0,
    net_platform_income DECIMAL(18,6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
