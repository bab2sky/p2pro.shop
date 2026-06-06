-- Add is_digital flag to categories
-- Digital categories (NFT, AI solutions, etc.) do not require physical shipping address.
-- When all cart items belong to digital categories, checkout only shows recipient name + phone.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_digital BOOLEAN NOT NULL DEFAULT FALSE;
