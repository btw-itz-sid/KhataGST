-- Phase 3: GSTR-2B upload, ITC reconciliation buckets, IMS accept/reject.
-- No live GSTN fetch — JSON upload / paste until a licensed GSP is wired.

CREATE TABLE IF NOT EXISTS gstr2b_imports (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    tax_period    VARCHAR(7) NOT NULL,
    source        VARCHAR(30) NOT NULL DEFAULT 'json_upload',
    raw_json      JSONB NOT NULL,
    imported_by   UUID REFERENCES users(id),
    row_count     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gstr2b_rows (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id        UUID NOT NULL REFERENCES gstr2b_imports(id) ON DELETE CASCADE,
    business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    tax_period       VARCHAR(7) NOT NULL,
    supplier_gstin   VARCHAR(15),
    supplier_name    VARCHAR(255),
    invoice_number   VARCHAR(80) NOT NULL,
    invoice_date     DATE,
    taxable_paise    BIGINT NOT NULL DEFAULT 0,
    cgst_paise       BIGINT NOT NULL DEFAULT 0,
    sgst_paise       BIGINT NOT NULL DEFAULT 0,
    igst_paise       BIGINT NOT NULL DEFAULT 0,
    cess_paise       BIGINT NOT NULL DEFAULT 0,
    total_paise      BIGINT NOT NULL DEFAULT 0,
    ims_action       VARCHAR(20) NOT NULL DEFAULT 'pending',
    ims_note         TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT gstr2b_rows_ims_action_check
      CHECK (ims_action IN ('pending', 'accept', 'reject'))
);

CREATE TABLE IF NOT EXISTS itc_recon_results (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    tax_period           VARCHAR(7) NOT NULL,
    run_id               UUID NOT NULL,
    bucket               VARCHAR(40) NOT NULL,
    our_invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
    gstr2b_row_id        UUID REFERENCES gstr2b_rows(id) ON DELETE SET NULL,
    supplier_gstin       VARCHAR(15),
    invoice_number       VARCHAR(80),
    books_taxable_paise  BIGINT NOT NULL DEFAULT 0,
    portal_taxable_paise BIGINT NOT NULL DEFAULT 0,
    books_tax_paise      BIGINT NOT NULL DEFAULT 0,
    portal_tax_paise     BIGINT NOT NULL DEFAULT 0,
    difference_paise     BIGINT NOT NULL DEFAULT 0,
    risk_paise           BIGINT NOT NULL DEFAULT 0,
    match_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT itc_recon_results_bucket_check
      CHECK (bucket IN ('matched', 'mismatch', 'in_books_not_2b', 'in_2b_not_books'))
);

CREATE INDEX IF NOT EXISTS idx_gstr2b_imports_biz_period
  ON gstr2b_imports (business_id, tax_period, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gstr2b_rows_biz_period
  ON gstr2b_rows (business_id, tax_period);

CREATE INDEX IF NOT EXISTS idx_gstr2b_rows_supplier
  ON gstr2b_rows (business_id, supplier_gstin, invoice_number);

CREATE INDEX IF NOT EXISTS idx_itc_recon_biz_period
  ON itc_recon_results (business_id, tax_period, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_itc_recon_run
  ON itc_recon_results (run_id);
