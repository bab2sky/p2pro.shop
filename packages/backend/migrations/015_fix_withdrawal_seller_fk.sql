-- Migration 015: Fix withdrawal_requests.seller_id FK constraint
-- The FK was referencing users(id) but code stores seller_profiles.id values.
-- Fix: reference seller_profiles(id) instead.

ALTER TABLE withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_seller_id_fkey;

ALTER TABLE withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES seller_profiles(id);
