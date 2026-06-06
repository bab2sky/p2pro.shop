-- Migration: 020_korean_marketplace_phase_a.sql
-- Phase A: 법적 필수 + 상품 확장 (한국 오픈마켓 기능 고도화)
-- Date: 2026-03-12

-- 1. Category Attributes (카테고리별 필수 속성 - 전자상거래법)
CREATE TABLE IF NOT EXISTS category_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_name_en VARCHAR(100),
    attribute_type VARCHAR(20) NOT NULL CHECK (attribute_type IN ('text', 'select', 'number', 'date', 'boolean')),
    is_required BOOLEAN DEFAULT false,
    options JSONB,
    placeholder VARCHAR(200),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, attribute_name)
);
CREATE INDEX IF NOT EXISTS idx_category_attributes_category ON category_attributes(category_id);

-- 2. Product Attributes (상품별 속성 값)
CREATE TABLE IF NOT EXISTS product_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, attribute_id)
);
CREATE INDEX IF NOT EXISTS idx_product_attributes_product ON product_attributes(product_id);

-- 3. Products 확장 컬럼
-- KC인증 정보 (JSONB)
ALTER TABLE products ADD COLUMN IF NOT EXISTS kc_certification JSONB;

-- 제조사/원산지
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200);
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_country VARCHAR(100);

-- 상품 상태 (새제품/중고/리퍼비시)
ALTER TABLE products ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'new';

-- 임시저장
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- 예약 등록
ALTER TABLE products ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_products_condition ON products(condition) WHERE condition != 'new';
CREATE INDEX IF NOT EXISTS idx_products_draft ON products(is_draft) WHERE is_draft = true;
CREATE INDEX IF NOT EXISTS idx_products_scheduled ON products(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- 5. 플랫폼 사업자 정보 (system_settings)
INSERT INTO system_settings (key, value, description) VALUES
('business_company_name', '', '상호명'),
('business_representative', '', '대표자명'),
('business_number', '', '사업자등록번호'),
('business_online_sales_number', '', '통신판매업 신고번호'),
('business_address', '', '사업장 주소'),
('business_customer_center', '', '고객센터 전화번호'),
('business_email', '', '고객센터 이메일'),
('escrow_service_description', 'USDT 에스크로 구매안전서비스 가입 사실을 확인합니다.', '구매안전서비스 고지 문구')
ON CONFLICT (key) DO NOTHING;
