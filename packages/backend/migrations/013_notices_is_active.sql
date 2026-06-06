-- Add is_active column to notices table
ALTER TABLE notices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
