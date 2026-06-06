-- Phase 6: System Settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO system_settings (key, value) VALUES
('commission_rate', '5'),
('auto_confirm_days', '7'),
('txid_timeout_hours', '24'),
('min_withdrawal', '10'),
('withdrawal_fee_rate', '5'),
('dispute_deadline_days', '14')
ON CONFLICT (key) DO NOTHING;
