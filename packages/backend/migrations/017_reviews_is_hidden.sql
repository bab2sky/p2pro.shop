-- Add is_hidden column to reviews for admin moderation
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
