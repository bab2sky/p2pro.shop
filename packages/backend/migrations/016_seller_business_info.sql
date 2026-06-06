-- Add business info columns to seller_profiles for 사업자 type sellers
ALTER TABLE seller_profiles
    ADD COLUMN IF NOT EXISTS business_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS business_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS representative_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS business_address TEXT,
    ADD COLUMN IF NOT EXISTS business_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS business_category VARCHAR(100);
