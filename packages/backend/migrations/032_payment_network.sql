-- Add payment_network column to orders table
-- Supports: "ERC-20", "TRC-20", "BEP-20"
ALTER TABLE orders ADD COLUMN payment_network VARCHAR(10);
