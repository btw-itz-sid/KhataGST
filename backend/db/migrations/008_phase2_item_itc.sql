-- Phase 2: line-item ITC so mixed bills don't over-claim Section 17(5) credit.

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(20) NOT NULL DEFAULT 'eligible';

ALTER TABLE invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_itc_eligibility_check;

ALTER TABLE invoice_items
  ADD CONSTRAINT invoice_items_itc_eligibility_check
  CHECK (itc_eligibility IN ('eligible', 'blocked', 'rcm_applicable'));
