-- db/migration_rbac_and_storage.sql
-- Migration: Add Role-Based Access Control (RBAC), Storage metadata, and Audit Logs

-- 1. Add user role column to users table if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'owner';
        -- Supported roles: 'owner', 'admin', 'ca', 'accountant', 'viewer'
    END IF;
END $$;

-- 2. Add storage columns to bill_scans for Cloud Object Storage (S3 / Cloudflare R2 / Azure)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bill_scans' AND column_name = 'storage_provider'
    ) THEN
        ALTER TABLE bill_scans ADD COLUMN storage_provider VARCHAR(50) DEFAULT 'local';
        ALTER TABLE bill_scans ADD COLUMN storage_key TEXT;
    END IF;
END $$;

-- 3. Audit Logs Table (For tracking actions, changes, and compliance events)
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
    action        VARCHAR(100) NOT NULL, -- e.g. 'INVOICE_CREATED', 'RETURN_FILED', 'ROLE_CHANGED'
    entity_type   VARCHAR(50) NOT NULL,  -- e.g. 'invoice', 'return', 'user', 'party'
    entity_id     UUID,
    details       JSONB,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_biz ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
