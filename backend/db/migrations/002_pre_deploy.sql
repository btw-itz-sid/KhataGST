-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Pre-Deploy Fixes
-- Run this on Neon before deploying to Railway
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. businesses mein updated_at column add karo (PUT route ke liye zaroori)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. gst_returns mein updated_at column add karo (recompute route ke liye zaroori)
ALTER TABLE gst_returns
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. OTP verifications table — in-memory Map ki jagah DB use karenge
CREATE TABLE IF NOT EXISTS otp_verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(15)   NOT NULL,
  otp_hash    TEXT          NOT NULL,    -- bcrypt hash nahi, simple SHA256 for speed
  otp         VARCHAR(6)    NOT NULL,    -- plaintext (expires in 10 min)
  attempts    INTEGER       NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ   NOT NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Index for fast lookup by phone
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);

-- 4. Index for invoice_number lookups (duplicate check fast karne ke liye)
CREATE INDEX IF NOT EXISTS idx_invoices_number
  ON invoices(business_id, invoice_number, invoice_type);

-- 5. Auto-update triggers for new columns
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for businesses (agar pehle se nahi hai)
DROP TRIGGER IF EXISTS trg_businesses_updated ON businesses;
CREATE TRIGGER trg_businesses_updated
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger for gst_returns
DROP TRIGGER IF EXISTS trg_returns_updated ON gst_returns;
CREATE TRIGGER trg_returns_updated
  BEFORE UPDATE ON gst_returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
