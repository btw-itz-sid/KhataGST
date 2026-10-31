-- Phase 1: persist place of supply, ITC eligibility, and a "prepared" return status.
-- "prepared" means ready for the GST portal / CA — KhataGST does not file on GSTN.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(2),
  ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(20) NOT NULL DEFAULT 'eligible';

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_itc_eligibility_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_itc_eligibility_check
  CHECK (itc_eligibility IN ('eligible', 'blocked', 'rcm_applicable'));

CREATE INDEX IF NOT EXISTS idx_invoices_itc_eligibility
  ON invoices (business_id, itc_eligibility);

ALTER TYPE return_status ADD VALUE IF NOT EXISTS 'prepared';
