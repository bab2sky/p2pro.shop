-- Migration: 021_korean_marketplace_phase_b.sql
-- Phase B: 리뷰/검색 고도화
-- Date: 2026-03-12

-- 1. Review Votes (리뷰 도움됨 투표)
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);

-- 2. Reviews 확장 컬럼
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INT DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS unhelpful_count INT DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS points_earned INT DEFAULT 0;

-- 3. Search Keywords (인기 검색어)
CREATE TABLE IF NOT EXISTS search_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(200) NOT NULL,
    search_count INT DEFAULT 1,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE(keyword, date)
);
CREATE INDEX IF NOT EXISTS idx_search_keywords_date ON search_keywords(date DESC, search_count DESC);

-- 4. Products 검색 태그
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_tags TEXT[];
CREATE INDEX IF NOT EXISTS idx_products_search_tags ON products USING gin(search_tags);

-- 5. Product Options 이미지
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS image_url TEXT;
