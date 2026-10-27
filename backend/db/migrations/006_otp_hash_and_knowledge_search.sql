-- db/migrations/006_otp_hash_and_knowledge_search.sql
-- Run this before deploying the backend that ships with it.

-- 1. OTPs: ab sirf HMAC hash store hota hai, plaintext column hatao
-- Purane rows ke otp_hash mein plaintext tha, woh naye HMAC se verify nahi honge (10 min mein expire hote hi)
DELETE FROM otp_verifications;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS otp;

-- 2. Knowledge base: ek statutory section = ek row, taaki seed script upsert kar sake
CREATE UNIQUE INDEX IF NOT EXISTS uq_gst_knowledge_section
ON gst_knowledge_base (source_act, section_number);

-- 3. IVFFlat needs training data: built on an empty table with lists = 100 it skips most rows.
--    HNSW has no training step and stays accurate at any table size.
DROP INDEX IF EXISTS idx_gst_knowledge_embedding;
CREATE INDEX IF NOT EXISTS idx_gst_knowledge_embedding_hnsw
ON gst_knowledge_base USING hnsw (embedding vector_cosine_ops);
