-- FR-04/FR-05: Trigram indexes for search performance optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- FR-04: Product title trigram index for autocomplete
CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON products USING gin (title gin_trgm_ops);

-- FR-05: User search trigram indexes for admin user management
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
    ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_real_name_trgm
    ON users USING gin (real_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_nickname_trgm
    ON users USING gin (COALESCE(nickname, '') gin_trgm_ops);
