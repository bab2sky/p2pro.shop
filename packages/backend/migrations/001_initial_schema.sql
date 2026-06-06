-- ============================================================
-- UDG P2P 오픈마켓 - Initial Schema
-- ============================================================

-- 1. USERS
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   TEXT NOT NULL,
    real_name       VARCHAR(100) NOT NULL,
    nickname        VARCHAR(50),
    profile_image   TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'buyer',
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_udg_member   BOOLEAN DEFAULT FALSE,
    referrer_id     UUID REFERENCES users(id),
    totp_secret     TEXT,
    is_2fa_enabled  BOOLEAN DEFAULT FALSE,
    locale          VARCHAR(5) DEFAULT 'ko',
    theme           VARCHAR(10) DEFAULT 'light',
    status          VARCHAR(20) DEFAULT 'active',
    withdrawn_at    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_referrer ON users(referrer_id);

-- 2. SELLER_PROFILES
CREATE TABLE seller_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_type     VARCHAR(20) NOT NULL DEFAULT 'individual',
    wallet_address  VARCHAR(42) NOT NULL,
    contact_phone   VARCHAR(20),
    main_category_id UUID,
    deposit_amount  DECIMAL(18,6) DEFAULT 0,
    deposit_txid    VARCHAR(66),
    balance         DECIMAL(18,6) DEFAULT 0,
    total_sales     INTEGER DEFAULT 0,
    total_revenue   DECIMAL(18,6) DEFAULT 0,
    avg_rating      DECIMAL(3,2) DEFAULT 0,
    response_rate   DECIMAL(5,2) DEFAULT 0,
    avg_ship_days   DECIMAL(4,1) DEFAULT 0,
    grade           SMALLINT DEFAULT 1,
    grade_score     DECIMAL(5,4) DEFAULT 0,
    dispute_count   INTEGER DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending',
    rejected_reason TEXT,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seller_user ON seller_profiles(user_id);
CREATE INDEX idx_seller_grade ON seller_profiles(grade DESC);
CREATE INDEX idx_seller_status ON seller_profiles(status);

-- 3. CATEGORIES
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    name_en         VARCHAR(100),
    slug            VARCHAR(100) UNIQUE NOT NULL,
    icon            TEXT,
    depth           SMALLINT NOT NULL DEFAULT 0,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Add FK to seller_profiles after categories exists
ALTER TABLE seller_profiles
    ADD CONSTRAINT fk_seller_main_category FOREIGN KEY (main_category_id) REFERENCES categories(id);

-- 4. PRODUCTS
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    base_price      DECIMAL(18,6) NOT NULL,
    margin_rate     DECIMAL(5,2) NOT NULL,
    final_price     DECIMAL(18,6) GENERATED ALWAYS AS (base_price * (1 + margin_rate / 100)) STORED,
    shipping_fee    DECIMAL(18,6) DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    sold_count      INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    wishlist_count  INTEGER DEFAULT 0,
    review_count    INTEGER DEFAULT 0,
    avg_rating      DECIMAL(3,2) DEFAULT 0,
    return_policy   TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    rejected_reason TEXT,
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_products_final_price ON products(final_price);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('simple', title || ' ' || COALESCE(description, '')));

-- 5. PRODUCT_IMAGES
CREATE TABLE product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    sort_order      SMALLINT DEFAULT 0,
    is_main         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- 6. PRODUCT_OPTIONS
CREATE TABLE product_options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    option_name     VARCHAR(50) NOT NULL,
    option_value    VARCHAR(100) NOT NULL,
    additional_price DECIMAL(18,6) DEFAULT 0,
    stock           INTEGER NOT NULL DEFAULT 0,
    sort_order      SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_options_product ON product_options(product_id);

-- 7. ADDRESSES
CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           VARCHAR(50),
    recipient_name  VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    zipcode         VARCHAR(10) NOT NULL,
    address1        VARCHAR(200) NOT NULL,
    address2        VARCHAR(200),
    is_default      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- 8. ORDERS
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    buyer_id        UUID NOT NULL REFERENCES users(id),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id),
    recipient_name  VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    zipcode         VARCHAR(10) NOT NULL,
    address1        VARCHAR(200) NOT NULL,
    address2        VARCHAR(200),
    shipping_memo   TEXT,
    subtotal        DECIMAL(18,6) NOT NULL,
    shipping_fee    DECIMAL(18,6) NOT NULL DEFAULT 0,
    margin_amount   DECIMAL(18,6) NOT NULL,
    total_amount    DECIMAL(18,6) NOT NULL,
    company_wallet  VARCHAR(42) NOT NULL,
    courier_name    VARCHAR(50),
    tracking_number VARCHAR(50),
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
    auto_confirm_at TIMESTAMPTZ,
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    seller_memo     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_auto_confirm ON orders(auto_confirm_at) WHERE status = 'delivered';

-- 9. ORDER_ITEMS
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    product_title   VARCHAR(200) NOT NULL,
    option_id       UUID REFERENCES product_options(id),
    option_label    VARCHAR(200),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      DECIMAL(18,6) NOT NULL,
    subtotal        DECIMAL(18,6) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- 10. TRANSACTIONS (TXID)
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    txid            VARCHAR(66) UNIQUE NOT NULL,
    from_address    VARCHAR(42),
    to_address      VARCHAR(42),
    amount          DECIMAL(18,6),
    token_symbol    VARCHAR(10) DEFAULT 'USDT',
    block_number    BIGINT,
    block_timestamp TIMESTAMPTZ,
    gas_used        DECIMAL(18,6),
    check_recipient BOOLEAN DEFAULT FALSE,
    check_amount    BOOLEAN DEFAULT FALSE,
    check_timestamp BOOLEAN DEFAULT FALSE,
    check_duplicate BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    reject_reason   TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_transactions_txid ON transactions(txid);
CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_transactions_status ON transactions(verification_status);

-- 11. SETTLEMENTS
CREATE TABLE settlements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id),
    order_id        UUID REFERENCES orders(id),
    type            VARCHAR(20) NOT NULL,
    amount          DECIMAL(18,6) NOT NULL,
    fee_rate        DECIMAL(5,2) DEFAULT 0,
    fee_amount      DECIMAL(18,6) DEFAULT 0,
    net_amount      DECIMAL(18,6) NOT NULL,
    wallet_address  VARCHAR(42),
    withdrawal_txid VARCHAR(66),
    status          VARCHAR(20) DEFAULT 'pending',
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    reject_reason   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlements_seller ON settlements(seller_id);
CREATE INDEX idx_settlements_order ON settlements(order_id);
CREATE INDEX idx_settlements_status ON settlements(status);
CREATE INDEX idx_settlements_type ON settlements(type);

-- 12. REVIEWS
CREATE TABLE reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    buyer_id        UUID NOT NULL REFERENCES users(id),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id),
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content         TEXT,
    images          TEXT[],
    seller_reply    TEXT,
    seller_replied_at TIMESTAMPTZ,
    is_reported     BOOLEAN DEFAULT FALSE,
    report_reason   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_buyer ON reviews(buyer_id);
CREATE INDEX idx_reviews_seller ON reviews(seller_id);
CREATE UNIQUE INDEX idx_reviews_order_product ON reviews(order_id, product_id);

-- 13. DISPUTES
CREATE TABLE disputes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID UNIQUE NOT NULL REFERENCES orders(id),
    buyer_id        UUID NOT NULL REFERENCES users(id),
    seller_id       UUID NOT NULL REFERENCES seller_profiles(id),
    dispute_type    VARCHAR(30) NOT NULL,
    reason          TEXT NOT NULL,
    evidence_files  TEXT[],
    seller_response TEXT,
    seller_evidence TEXT[],
    resolution      VARCHAR(30),
    resolution_detail TEXT,
    refund_amount   DECIMAL(18,6),
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'open',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_buyer ON disputes(buyer_id);

-- 14. MESSAGES
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES users(id),
    receiver_id     UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    image_url       TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id),
    created_at DESC
);

-- 15. NOTIFICATIONS
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    content         TEXT,
    link            TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- 16. WISHLIST
CREATE TABLE wishlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlist_user ON wishlist(user_id);

-- 17. PRODUCT_QNA
CREATE TABLE product_qna (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    question        TEXT NOT NULL,
    answer          TEXT,
    answered_at     TIMESTAMPTZ,
    is_secret       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_qna_product ON product_qna(product_id, created_at DESC);

-- 18. REPORTS
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    target_type     VARCHAR(20) NOT NULL,
    target_id       UUID NOT NULL,
    reason_type     VARCHAR(30) NOT NULL,
    reason_detail   TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    resolved_by     UUID REFERENCES users(id),
    resolution      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_reports_status ON reports(status);

-- 19. BANNERS
CREATE TABLE banners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(200) NOT NULL,
    image_url       TEXT NOT NULL,
    link_url        TEXT,
    position        VARCHAR(20) NOT NULL DEFAULT 'hero',
    sort_order      INTEGER DEFAULT 0,
    starts_at       TIMESTAMPTZ,
    ends_at         TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 20. NOTICES
CREATE TABLE notices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    target          VARCHAR(20) DEFAULT 'all',
    is_pinned       BOOLEAN DEFAULT FALSE,
    author_id       UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 21. FAQ
CREATE TABLE faqs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(50) NOT NULL,
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 22. SYSTEM_SETTINGS
CREATE TABLE system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_settings (key, value, description) VALUES
('withdrawal_fee_rate', '5.0', 'Withdrawal fee rate (%)'),
('min_withdrawal_amount', '10.0', 'Minimum withdrawal amount (USDT)'),
('min_margin_rate', '5.0', 'Minimum margin rate (%)'),
('max_margin_rate', '40.0', 'Maximum margin rate (%)'),
('auto_confirm_days', '7', 'Auto purchase confirmation days'),
('txid_timeout_hours', '24', 'TXID submission timeout hours'),
('company_wallet_address', '', 'Escrow company wallet address'),
('seller_deposit_amount', '0', 'Seller deposit amount (USDT)');

-- 23. ADMIN_LOGS
CREATE TABLE admin_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_type, target_id);

-- 24. USER_BLOCKS
CREATE TABLE user_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, blocked_user_id)
);

-- 25. REFRESH_TOKENS
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    device_info     TEXT,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
