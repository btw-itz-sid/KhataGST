-- db/migration_knowledge_vector.sql
-- Migration: Enable pgvector and create the GST Statutory Knowledge Base

-- 1. Enable pgvector extension (supported natively on Neon PostgreSQL)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. GST Knowledge Base Table for RAG & AI CA Legal Intelligence
CREATE TABLE IF NOT EXISTS gst_knowledge_base (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_title        VARCHAR(255) NOT NULL,
    source_act           VARCHAR(100) NOT NULL, -- 'CGST_ACT', 'SGST_ACT', 'IGST_ACT', 'RULES', 'CIRCULAR', 'HSN_GUIDE'
    section_number       VARCHAR(50),           -- e.g. '16', '17(5)', '88A', '86B', '50'
    category             VARCHAR(100) NOT NULL, -- 'ITC_ELIGIBILITY', 'BLOCKED_CREDIT', 'SET_OFF_RULES', 'RCM', 'INVOICE_RULES', 'INTEREST_PENALTY'
    content              TEXT NOT NULL,
    legal_rule_metadata  JSONB,                 -- structured metadata for deterministic parsing
    embedding            vector(768),           -- 768 dimensions for Gemini text-embedding-004
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_gst_knowledge_embedding 
ON gst_knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_gst_knowledge_category ON gst_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_gst_knowledge_section ON gst_knowledge_base(section_number);
