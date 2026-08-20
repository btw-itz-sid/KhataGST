-- db/migration_gst_rates.sql
-- GST Rate Master table — 0%, 5%, 12%, 18%, 28% maintain karo

CREATE TABLE IF NOT EXISTS gst_rates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hsn_sac         VARCHAR(10) NOT NULL,
    description     VARCHAR(255),
    gst_rate        NUMERIC(4,2) NOT NULL,
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    is_active       BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hsn_sac, effective_from)
);

-- Index for faster HSN/SAC lookups
CREATE INDEX IF NOT EXISTS idx_gst_rates_hsn_sac ON gst_rates(hsn_sac);
CREATE INDEX IF NOT EXISTS idx_gst_rates_active ON gst_rates(is_active);

-- Insert default GST rates (optional starting data)
INSERT INTO gst_rates (hsn_sac, description, gst_rate, is_active)
VALUES
    ('0000', 'No GST / Exempt', 0.00, TRUE),
    ('1000', 'Basic Goods Rate', 5.00, TRUE),
    ('2000', 'Standard Rate', 12.00, TRUE),
    ('3000', 'Standard Rate', 18.00, TRUE),
    ('4000', 'Luxury Rate', 28.00, TRUE)
ON CONFLICT (hsn_sac, effective_from) DO NOTHING;
