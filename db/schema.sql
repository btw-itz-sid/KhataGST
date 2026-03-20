CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE plan_type     AS ENUM ('free', 'basic', 'ca_pro');
CREATE TYPE invoice_type  AS ENUM ('sale', 'purchase', 'credit_note', 'debit_note');
CREATE TYPE return_status AS ENUM ('draft', 'computed', 'filed', 'error');
CREATE TYPE scan_status   AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE itc_status    AS ENUM ('matched', 'mismatched', 'pending', 'reversed');

-- Users table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    name            VARCHAR(255),
    password_hash   TEXT,
    plan            plan_type NOT NULL DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    razorpay_sub_id VARCHAR(100),
    preferred_lang  VARCHAR(10) DEFAULT 'hi',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses (ek user ke multiple GSTINs)
CREATE TABLE businesses (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gstin         VARCHAR(15) UNIQUE NOT NULL,
    legal_name    VARCHAR(255) NOT NULL,
    trade_name    VARCHAR(255),
    address       TEXT,
    state_code    VARCHAR(2) NOT NULL,
    business_type VARCHAR(50),
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CA aur client ka link
CREATE TABLE ca_client_links (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ca_user_id    UUID NOT NULL REFERENCES users(id),
    client_biz_id UUID NOT NULL REFERENCES businesses(id),
    access_level  VARCHAR(20) DEFAULT 'read_write',
    linked_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ca_user_id, client_biz_id)
);

-- Parties (customers aur suppliers)
CREATE TABLE parties (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    gstin       VARCHAR(15),
    name        VARCHAR(255) NOT NULL,
    phone       VARCHAR(15),
    email       VARCHAR(255),
    address     TEXT,
    state_code  VARCHAR(2),
    is_supplier BOOLEAN DEFAULT FALSE,
    is_customer BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    party_id       UUID REFERENCES parties(id),
    invoice_type   invoice_type NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date   DATE NOT NULL,
    due_date       DATE,
    taxable_value  BIGINT NOT NULL DEFAULT 0,
    cgst_amount    BIGINT DEFAULT 0,
    sgst_amount    BIGINT DEFAULT 0,
    igst_amount    BIGINT DEFAULT 0,
    total_amount   BIGINT NOT NULL DEFAULT 0,
    is_igst        BOOLEAN DEFAULT FALSE,
    reverse_charge BOOLEAN DEFAULT FALSE,
    notes          TEXT,
    source         VARCHAR(20) DEFAULT 'manual',
    is_cancelled   BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, invoice_number, invoice_type)
);

-- Invoice ke line items
CREATE TABLE invoice_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description   VARCHAR(500) NOT NULL,
    hsn_sac       VARCHAR(10),
    quantity      NUMERIC(10,3),
    unit          VARCHAR(20),
    unit_price    BIGINT,
    gst_rate      VARCHAR(5) NOT NULL DEFAULT '18',
    taxable_value BIGINT NOT NULL,
    cgst_amount   BIGINT DEFAULT 0,
    sgst_amount   BIGINT DEFAULT 0,
    igst_amount   BIGINT DEFAULT 0
);

-- Bill scan (AI feature)
CREATE TABLE bill_scans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id     UUID NOT NULL REFERENCES businesses(id),
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    file_url        TEXT NOT NULL,
    status          scan_status DEFAULT 'queued',
    ai_raw_response JSONB,
    extracted_data  JSONB,
    confidence      NUMERIC(4,2),
    error_message   TEXT,
    invoice_id      UUID REFERENCES invoices(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- GST Returns
CREATE TABLE gst_returns (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID NOT NULL REFERENCES businesses(id),
    return_type  VARCHAR(10) NOT NULL,
    tax_period   VARCHAR(7) NOT NULL,
    status       return_status DEFAULT 'draft',
    summary_json JSONB,
    filing_json  JSONB,
    arn          VARCHAR(50),
    filed_at     TIMESTAMPTZ,
    due_date     DATE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, return_type, tax_period)
);

-- ITC Reconciliation
CREATE TABLE itc_reconciliation (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id      UUID NOT NULL REFERENCES businesses(id),
    tax_period       VARCHAR(7) NOT NULL,
    our_invoice_id   UUID REFERENCES invoices(id),
    status           itc_status DEFAULT 'pending',
    difference_paise BIGINT DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id),
    razorpay_order   VARCHAR(100),
    razorpay_payment VARCHAR(100),
    amount_paise     INTEGER NOT NULL,
    plan             plan_type NOT NULL,
    status           VARCHAR(20) DEFAULT 'pending',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (query fast karne ke liye)
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_date     ON invoices(invoice_date);
CREATE INDEX idx_parties_business  ON parties(business_id);
CREATE INDEX idx_scans_business    ON bill_scans(business_id);
CREATE INDEX idx_returns_business  ON gst_returns(business_id);

-- Auto updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_invoices_updated
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();