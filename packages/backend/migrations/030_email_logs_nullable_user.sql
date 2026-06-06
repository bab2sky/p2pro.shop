-- Allow email_logs.user_id to be NULL for pre-signup email verification
ALTER TABLE email_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
