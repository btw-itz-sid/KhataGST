# KhataGST — Claude Code Instructions

## Project Overview
KhataGST is an AI-powered GST filing SaaS for Indian MSMEs.
Target: small shopkeepers, traders, CAs managing multiple clients.

## Tech Stack
- Backend: Node.js + Fastify + TypeScript
- Database: PostgreSQL (schema in db/schema.sql)
- AI: Anthropic Claude API (bill scan feature)
- Payments: Razorpay
- Notifications: Twilio WhatsApp

## Key Business Rules
1. All amounts stored in PAISE (integer). ₹100 = 10000 paise
2. GSTIN = 15 character alphanumeric string
3. Same state transaction = CGST + SGST (split equally)
4. Different state transaction = IGST only
5. Free plan: max 1 GSTIN, 50 invoices/month
6. CA Pro plan: unlimited GSTINs, 20 client businesses

## API Rules
- All routes start with /api/v1/
- Auth: Bearer JWT token in header
- Success response: { success: true, data: {...} }
- Error response: { success: false, error: { code, message } }

## GST Return Due Dates
- GSTR-1: 11th of next month
- GSTR-3B: 20th of next month
- GSTR-9 (annual): 31st December

## Folder Structure
- src/routes/     → API endpoints
- src/services/   → Business logic
- src/lib/        → DB, Redis connections
- db/schema.sql   → Database tables