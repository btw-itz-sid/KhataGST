<div align="center">

# 🧾 KhataGST

### **The Autonomous AI Chartered Accountant for Indian MSMEs**
*Autonomous GST Compliance • Section 17(5) ITC Optimization • Statutory Tax RAG • Deterministic Return Filing*

[![Status](https://img.shields.io/badge/Status-Enterprise--Ready-00C853?style=for-the-badge&logo=statuspage&logoColor=white)](https://github.com/btw-itz-sid/KhataGST)
[![Backend](https://img.shields.io/badge/Backend-Fastify%20%7C%20TypeScript%20%7C%20Node.js-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://github.com/btw-itz-sid/KhataGST)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Tailwind-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://github.com/btw-itz-sid/KhataGST)
[![Database](https://img.shields.io/badge/Database-Neon%20PostgreSQL%20%28pgvector%29-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Storage](https://img.shields.io/badge/Cloud%20Storage-AWS%20S3%20%2F%20Cloudflare%20R2-FF9900?style=for-the-badge&logo=amazons3&logoColor=white)](https://aws.amazon.com/s3/)

<br />

[Explore Features](#-key-capabilities) • [System Architecture](#-system-architecture) • [Statutory AI CA](#-autonomous-ai-ca--tax-rag-engine) • [API Reference](#-complete-api-reference) • [Getting Started](#-getting-started) • [Deployment](#-production-deployment)

---

</div>

## 📌 Executive Summary & The Problem

India is home to over **63 million Micro, Small, and Medium Enterprises (MSMEs)** that contribute roughly 30% to the country's GDP. Despite digitization under the Goods and Services Tax (GST) regime, tax compliance remains a crippling bottleneck:

1. **Complex Statutory Compliance Traps**: A standard regular taxpayer must navigate up to **37 statutory filings annually** (GSTR-1, GSTR-3B, GSTR-9, etc.) alongside evolving CBIC circulars, notifications, and GST Council rate revisions.
2. **Massive Input Tax Credit (ITC) Leakage**: Small businesses lose an estimated **15% to 20% of eligible ITC** due to mismatched supplier invoices, inaccurate HSN/SAC classifications, and strict reconciliation rules under Section 16(2)(aa) / GSTR-2B.
3. **Section 17(5) Blocked Credit Penalties**: Inadvertently claiming ITC on blocked expenses (e.g., motor vehicles, food & beverages, personal consumption, club memberships) triggers mandatory departmental notices, tax recovery, and **18% annual interest penalties** under Section 50.
4. **Prohibitive CA & Compliance Costs**: Retaining dedicated Chartered Accountants (CAs) and tax consultants costs MSMEs anywhere from ₹3,000 to ₹25,000 per month, while manual paper-to-Excel bookkeeping creates compounding errors.

### 💡 The KhataGST Solution

**KhataGST** transforms GST compliance from a tedious, error-prone manual process into a **self-driving, autonomous financial intelligence system**. By pairing high-precision multimodal AI invoice OCR with a deterministic tax engine and a vector-indexed statutory knowledge layer, KhataGST acts as an always-on Autonomous Chartered Accountant:

- 📸 **Zero-Touch Invoice Extraction**: Captures physical receipts, scans, and PDFs with multimodal AI, performing paise-level mathematical verification with zero floating-point errors.
- 🧠 **Statutory Tax RAG & Legal Advisor**: Answers complex GST queries with exact citations from the CGST/SGST Acts, Central Tax notifications, and landmark High Court / Supreme Court precedents.
- 🛡️ **Autonomous Section 17(5) ITC Classifier**: Analyzes purchase line-items in real time, automatically flagging blocked credits, eligible ITC, and Reverse Charge Mechanism (RCM) liabilities.
- ⚡ **Deterministic Return Computation**: Compiles GSTR-1 outward supply tables (B2B, B2CL, B2CS, HSN summaries) and GSTR-3B summary liabilities with mathematical precision.
- 🏢 **Multi-Entity & Enterprise RBAC**: Enables business owners, accountants, and practicing CAs to manage multiple GSTINs with database-enforced role access and immutable audit logging.

---

## 🏛️ System Architecture

KhataGST is architected around a strict **4-Layer Autonomous Tax Intelligence Framework** with a clean monorepo separation between backend and frontend services:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            KHATA-GST ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 1: USER INTERACTION & CLIENT PRESENTATION (frontend/)              │
 │  • React 18 + Vite SPA with Glassmorphic Dark Design System                │
 │  • Mobile-First Responsive Layouts (PWA Ready)                             │
 │  • Centralized API Layer with Environment-Driven Base URL Routing          │
 │  • Session Persistence & React Error Boundary Resilience                   │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / JSON / Multipart
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  LAYER 2: SECURE API GATEWAY & BUSINESS CORE (backend/)                   │
 │  • Node.js + Fastify Engine with Structured HTTP Pipeline                  │
 │  • Per-Phone OTP Rate Limiting & Cooldown Protection (HTTP 429)            │
 │  • JWT Session Management (7-day lifecycle) with Database State Validation │
 │  • Database-Enforced Role-Based Access Control (RBAC: Owner, Admin, CA)    │
 │  • Immutable Compliance Audit Logging (`audit_logs` table)                 │
 │  • Sentry Telemetry & Database-Probing `/health` Monitoring               │
 └──────────────────┬──────────────────┬──────────────────┬───────────────────┘
                    │                  │                  │
         ┌──────────▼────────┐ ┌───────▼────────┐ ┌───────▼────────┐
         │ MULTIMODAL OCR    │ │ DETERMINISTIC  │ │ STATUTORY RAG  │
         │ Google Gemini AI  │ │ GST ENGINE     │ │ KNOWLEDGE BASE │
         │ Vision API        │ │ Paise-level    │ │ pgvector +     │
         │ Structured Schema │ │ Math Precision │ │ CGST Act 2017  │
         └──────────┬────────┘ └───────┬────────┘ └───────┬────────┘
                    │                  │                  │
 ┌──────────────────▼──────────────────▼──────────────────▼───────────────────┐
 │  LAYER 3: PERSISTENCE & STORAGE INFRASTRUCTURE                             │
 │  • Neon Serverless PostgreSQL with SSL Connection Pooling & Auto-Retry     │
 │  • Numbered Migrations (001_schema.sql to 005_knowledge_vector.sql)        │
 │  • Unified Cloud Object Storage: AWS S3 / Cloudflare R2 / Local Disk       │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
 ┌─────────────────────────────────────▼──────────────────────────────────────┐
 │  LAYER 4: EXTERNAL INTEGRATIONS & TELEMETRY                                │
 │  • Fast2SMS Production OTP Gateway                                         │
 │  • Razorpay Payment Orders & Verified HMAC-SHA256 Webhooks                 │
 │  • Nodemailer Multi-Provider Email Notifications (SMTP / Gmail)            │
 │  • Sentry Error Tracking & Exception Reporting                             │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Capabilities

### 1. 📸 Intelligent Bill Scanning & Multimodal OCR
- Accepts invoice photos, JPEG/PNG images, and multi-page PDFs (up to 10MB).
- Powered by **Google Gemini 2.5 Flash** with strict JSON Schema constraints.
- Extracts: Supplier/Customer GSTIN, Invoice Number, Invoice Date, Due Date, HSN/SAC codes, Line-item descriptions, quantities, unit prices, taxable values, CGST, SGST, and IGST breakdowns.
- **Zero Floating-Point Drift**: All monetary values are immediately normalized into integer **paise** (`₹100.50` = `10050` paise) to eliminate JavaScript IEEE-754 floating-point inaccuracies.
- Automatic image persistence via **AWS S3 / Cloudflare R2** with local storage fallback.

### 2. 🧠 Autonomous AI CA & Tax RAG Engine
- Interactive conversational workspace for complex GST advisory queries.
- Backed by statutory knowledge embeddings in **Neon PostgreSQL (`pgvector`)**.
- Domain expertise covers:
  - **Section 16**: Four statutory conditions for claiming Input Tax Credit.
  - **Section 17(5)**: Explicit blocked credit clauses (motor vehicles, catering, employee insurance, works contract for immovable property, lost/stolen goods).
  - **Rule 88A**: Mandatory ITC utilization order (IGST first against IGST, then CGST/SGST in any proportion).
  - **Rule 86B**: Mandatory 1% minimum tax discharge through electronic cash ledger for taxable turnover exceeding ₹50 Lakhs.
  - **Reverse Charge Mechanism (RCM)** under Section 9(3) and 9(4) for goods transport agencies (GTA), legal advocates, and unregistered purchases.

### 3. 🛡️ Section 17(5) Autonomous Expense Classifier
- Submits any expense description (e.g., *"Staff lunch during quarterly client review"* or *"Company car annual insurance premium"*) to the AI classification agent.
- Returns:
  - `itcEligibility`: `eligible` | `blocked` | `rcm_applicable`
  - `blockedSection`: Precise statutory clause (e.g., `Section 17(5)(b)(i)` or `Section 17(5)(a)`)
  - `confidence`: Confidence score (0.0 to 1.0)
  - `explanation`: Detailed legal justification in plain business language
  - `recommendedAccountingLedger`: Standard accounting entry suggestion (e.g., *"Staff Welfare Expense (ITC Ineligible)"*)

### 4. 📊 Deterministic GSTR-1 & GSTR-3B Computation
- **GSTR-1 Outward Supplies Engine**:
  - Automatically segregates invoices into B2B (registered parties), B2CL (inter-state unregistered > ₹2.5 Lakhs), B2CS (intra-state and small inter-state unregistered), and HSN summary tables.
  - Generates audit-ready Excel (`.xlsx`) and CSV exports formatted for the official GST Portal offline utility.
- **GSTR-3B Summary Engine**:
  - Aggregates total outward taxable value, eligible ITC, ineligible ITC under Section 17(5), and net tax payable.

### 5. 🔒 Enterprise Security, RBAC & Telemetry
- **JWT Authentication**: 7-day token lifespan with instant client-side logout.
- **OTP Send Rate-Limiting**: 60-second per-phone cooldown to eliminate SMS credit exhaustion and denial-of-wallet attacks.
- **Role-Based Access Control**: Database-backed authorization for `owner`, `admin`, `ca`, `accountant`, and `viewer` roles.
- **Compliance Audit Trail**: Every sensitive operation (invoice creation, return computation, profile change) is logged in `audit_logs` with IP and user agent tracking.
- **Proactive Health Probing**: `/health` endpoint executes live connection and latency probes against Neon PostgreSQL.

---

## 📂 Repository Structure

The project is structured as an enterprise-grade monorepo:

```
KhataGST/
├── backend/                             # Fastify + TypeScript Backend Service
│   ├── src/
│   │   ├── index.ts                     # Fastify server bootstrap, Sentry, Swagger UI, /health
│   │   ├── routes/                      # Modular API route controllers (11 files)
│   │   │   ├── admin.ts                 # Admin analytics & user/business inspection
│   │   │   ├── aiCaRoutes.ts            # AI CA Copilot & Section 17(5) classifier endpoints
│   │   │   ├── auth.ts                  # OTP send/verify, JWT issuance, 60s cooldown
│   │   │   ├── businesses.ts            # Business profile CRUD & state management
│   │   │   ├── export.ts                # GSTR-1 Excel (.xlsx) & CSV export generation
│   │   │   ├── gstRates.ts              # HSN/SAC GST rate master CRUD & search
│   │   │   ├── invoices.ts              # Invoice CRUD, line-items, duplication & tax math
│   │   │   ├── parties.ts               # Supplier & Customer directory management
│   │   │   ├── payments.ts              # Razorpay order generation & verified webhooks
│   │   │   ├── returns.ts               # GSTR-1 & GSTR-3B compute and recompute logic
│   │   │   └── scans.ts                 # Multipart bill upload, Gemini OCR, storage
│   │   ├── services/                    # Core business logic & external integrations
│   │   │   ├── billScanService.ts       # Multimodal Gemini vision parser & JSON validator
│   │   │   ├── emailService.ts          # Nodemailer email templates (Welcome, Return, Reminders)
│   │   │   ├── exportService.ts         # ExcelJS multi-sheet workbook compiler
│   │   │   ├── gstEngine.ts             # Core tax math & paise normalization
│   │   │   ├── gstr1Service.ts          # GSTR-1 B2B/B2C/HSN aggregation engine
│   │   │   ├── gstr3bService.ts         # GSTR-3B tax liability & ITC compute engine
│   │   │   ├── knowledgeService.ts      # Statutory GST RAG vector knowledge retriever
│   │   │   └── storageService.ts        # Cloudflare R2 / AWS S3 / Local storage abstraction
│   │   ├── middleware/
│   │   │   └── rbac.ts                  # requireRole() guard & logAuditEvent() helper
│   │   ├── agents/
│   │   │   └── taxClassifierAgent.ts    # Section 17(5) heuristic & AI classification agent
│   │   ├── lib/
│   │   │   └── db.ts                    # Neon PostgreSQL pool, retry logic, health probe
│   │   └── types/
│   │       └── fastify.d.ts             # Fastify TypeScript declaration augmentation
│   ├── db/
│   │   └── migrations/                  # Numbered SQL schema migrations
│   │       ├── 001_schema.sql           # Core tables: users, businesses, invoices, returns
│   │       ├── 002_pre_deploy.sql       # OTP verifications table & performance indexes
│   │       ├── 003_rbac_storage.sql     # RBAC roles, storage metadata, audit_logs table
│   │       ├── 004_gst_rates.sql        # GST rate master table & HSN/SAC index
│   │       └── 005_knowledge_vector.sql # pgvector extension & GST statutory embeddings table
│   ├── .env.example                     # Comprehensive backend environment template
│   ├── package.json                     # Backend dependencies & build scripts
│   └── tsconfig.json                    # Strict Node16 TypeScript configuration
│
├── frontend/                            # React 18 + Vite Frontend Application
│   ├── src/
│   │   ├── components/                  # Shared UI components (ErrorBoundary, LoadingSpinner)
│   │   ├── lib/                         # Client utilities (api.ts with BASE_URL, session.ts)
│   │   ├── pages/                       # 11 Screen components
│   │   │   ├── Admin.tsx                # Enterprise administrative dashboard
│   │   │   ├── AiCaCopilot.tsx          # Autonomous AI CA advisory & classification workspace
│   │   │   ├── Dashboard.tsx            # Financial KPIs, tax summary & quick actions
│   │   │   ├── Export.tsx               # GSTR-1 Excel & CSV export generator
│   │   │   ├── GSTRates.tsx             # HSN/SAC GST rate master explorer & editor
│   │   │   ├── Invoices.tsx             # Invoice management, filtering, and copy-duplication
│   │   │   ├── Login.tsx                # Phone OTP authentication wizard
│   │   │   ├── Onboarding.tsx           # Multi-step business setup & GSTIN validator
│   │   │   ├── Pricing.tsx              # Subscription plans & Razorpay checkout
│   │   │   ├── Profile.tsx              # Business settings, trade name & address editor
│   │   │   └── Scan.tsx                 # Drag-and-drop bill scan & AI review workbench
│   │   ├── App.tsx                      # Central router & session guard
│   │   ├── main.tsx                     # React root wrapped in ErrorBoundary & StrictMode
│   │   └── index.css                    # Tailwind CSS + Glassmorphic design tokens
│   ├── .env.example                     # Frontend environment template
│   ├── package.json                     # Frontend dependencies
│   └── vite.config.ts                   # Vite build configuration
│
├── docs/                                # Technical Documentation & Runbooks
│   ├── BACKUP_AND_RECOVERY.md           # Neon PITR & pg_dump disaster recovery guide
│   └── samples/                         # Sample test files & exports
│
├── railway.toml                         # Railway production deployment configuration
├── .gitignore                           # Repository ignore rules (protects all .env & secrets)
└── README.md                            # Enterprise project documentation
```

---

## 🗄️ Database Architecture & Migrations

KhataGST utilizes **Neon Serverless PostgreSQL** with SSL-enforced connection pooling. All database schema changes are managed via ordered, idempotent migrations located in `backend/db/migrations/`:

| Migration File | Description | Key Tables / Columns |
|---|---|---|
| `001_schema.sql` | Foundation schema | `users`, `businesses`, `invoices`, `invoice_items`, `parties`, `gst_returns`, `bill_scans`, `payments`, `itc_reconciliation` |
| `002_pre_deploy.sql` | Production hardening | `otp_verifications` (in-database OTP storage with brute-force tracking), auto-updating `updated_at` triggers |
| `003_rbac_storage.sql` | Enterprise access & audit | `users.role` (`owner`, `admin`, `ca`, `accountant`), `bill_scans.storage_provider`, `audit_logs` table |
| `004_gst_rates.sql` | Rate master | `gst_rates` table for HSN/SAC lookup with effective date ranges |
| `005_knowledge_vector.sql` | AI vector layer | `pgvector` extension, `gst_statutory_knowledge` table with IVFFlat cosine similarity index |

---

## 📡 Complete API Reference

All API routes are prefixed under `/api/v1` and documentable via Swagger UI at `/api/docs`.

### Authentication (`/api/v1/auth`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/send-otp` | Public | Initiates 6-digit OTP delivery (60-second per-phone rate cooldown) |
| `POST` | `/verify-otp` | Public | Validates OTP, creates/retrieves user, issues 7-day JWT |
| `GET` | `/me` | JWT | Retrieves authenticated user profile & subscription tier |
| `POST` | `/logout` | JWT | Invalidates user session |

### AI CA Copilot & Intelligence (`/api/v1/ai-ca`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/ask` | JWT | RAG-powered statutory GST advisory with Act & Section citations |
| `POST` | `/classify-expense` | JWT | Autonomous Section 17(5) ITC eligibility & RCM classifier |
| `GET` | `/audit-summary` | JWT | Generates risk and compliance health audit for a business |

### Bill Scans & Multimodal AI (`/api/v1/scans`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/` | JWT | Uploads invoice image/PDF, triggers Gemini AI OCR, saves to S3/R2 |
| `GET` | `/:id` | JWT | Retrieves scan extraction result and confidence scores |
| `POST` | `/:id/retry` | JWT | Retries failed or low-confidence AI scans with fallback logic |

### Invoices & Tax Calculations (`/api/v1/invoices`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/` | JWT | Creates invoice with line-items, auto-computes CGST/SGST/IGST in paise |
| `GET` | `/` | JWT | Lists invoices with pagination, date range, party, and amount filters |
| `GET` | `/:id` | JWT | Retrieves single invoice with full line-item breakdown |
| `PUT` | `/:id` | JWT | Updates existing invoice and recalculates tax tables |
| `DELETE`| `/:id` | JWT | Deletes invoice and associated line-item records |
| `POST` | `/:id/duplicate` | JWT | Duplicates an existing invoice as a template with a new invoice number |

### GST Returns (`/api/v1/returns`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/gstr1/compute` | JWT | Compiles GSTR-1 return tables (B2B, B2CL, B2CS, HSN) for a period |
| `POST` | `/gstr3b/compute` | JWT | Compiles GSTR-3B tax summary, eligible ITC, and net tax liability |
| `POST` | `/gstr1/:id/recompute` | JWT | Recomputes GSTR-1 after invoice modifications |
| `POST` | `/gstr3b/:id/recompute` | JWT | Recomputes GSTR-3B after invoice modifications |
| `GET` | `/` | JWT | Lists all filed and computed returns for a business |

### Exports (`/api/v1/export`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/excel` | JWT | Generates and downloads multi-sheet GSTR-1 Excel (`.xlsx`) workbook |
| `GET` | `/csv` | JWT | Generates and downloads invoice transaction CSV export |

### Rate Master (`/api/v1/gst-rates`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/` | JWT | Lists active GST rates with HSN/SAC filtering |
| `GET` | `/:hsn_sac` | JWT | Looks up specific HSN or SAC rate details |
| `POST` | `/` | JWT (Admin) | Adds a new HSN/SAC rate entry |
| `PUT` | `/:id` | JWT (Admin) | Updates an existing HSN/SAC rate entry |
| `DELETE`| `/:id` | JWT (Admin) | Soft-deletes a rate entry |

### Payments & Subscriptions (`/api/v1/payments`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/order` | JWT | Creates a Razorpay subscription order (`basic` / `ca_pro`) |
| `POST` | `/verify` | JWT | Verifies Razorpay payment signature and upgrades user plan |
| `POST` | `/webhook` | Public | Verified HMAC-SHA256 Razorpay webhook receiver |

### Administration (`/api/v1/admin`)
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | RBAC (`admin`) | Aggregated system metrics (users, businesses, returns, scans) |
| `GET` | `/users` | RBAC (`admin`) | Paginated user management list with role inspection |
| `GET` | `/businesses` | RBAC (`admin`) | Paginated business directory across the platform |
| `GET` | `/returns` | RBAC (`admin`) | Platform-wide GST return filing status monitor |

### System Health
| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Real-time health check probing Neon DB latency and uptime |
| `GET` | `/api/docs` | Public | Interactive Swagger / OpenAPI 3.0 documentation |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Neon Serverless PostgreSQL database (with `pgvector` extension enabled)
- **Google AI Studio**: API key for Gemini 2.5 Flash
- **Fast2SMS**: API key for production OTP delivery (optional for local development)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/btw-itz-sid/KhataGST.git
cd KhataGST
```

---

### Step 2: Setup & Configure Backend

```bash
cd backend
npm install
```

Create `backend/.env` (refer to `backend/.env.example`):
```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Security (Generate via: openssl rand -hex 32)
JWT_SECRET=your-secure-random-32-character-jwt-secret-key

# AI Invoice Scanning
GEMINI_API_KEY=your-gemini-api-key

# Production OTP (Fast2SMS)
FAST2SMS_API_KEY=your-fast2sms-api-key

# Razorpay Payments (Optional for dev)
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Sentry Telemetry (Optional)
# SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Cloud Storage (Optional — defaults to local disk)
# R2_ACCOUNT_ID=your-cloudflare-account-id
# R2_ACCESS_KEY_ID=your-r2-access-key
# R2_SECRET_ACCESS_KEY=your-r2-secret-key
# R2_BUCKET=khatagst-uploads

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Execute database migrations against your Neon database:
```bash
# Execute migrations 001 through 005 in order via psql or Neon SQL Editor
psql "$DATABASE_URL" -f db/migrations/001_schema.sql
psql "$DATABASE_URL" -f db/migrations/002_pre_deploy.sql
psql "$DATABASE_URL" -f db/migrations/003_rbac_storage.sql
psql "$DATABASE_URL" -f db/migrations/004_gst_rates.sql
psql "$DATABASE_URL" -f db/migrations/005_knowledge_vector.sql
```

Run the backend development server:
```bash
npm run dev
# Server running at http://localhost:3000
# API Docs available at http://localhost:3000/api/docs
# Health probe available at http://localhost:3000/health
```

---

### Step 3: Setup & Configure Frontend

In a new terminal window:
```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Start the Vite development server:
```bash
npm run dev
# Frontend running at http://localhost:5173
```

---

## 🌐 Production Deployment

### Backend Deployment (Railway)
1. Link your GitHub repository to [Railway](https://railway.app).
2. Set the root directory or configure via the included `railway.toml`:
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && node dist/index.js`
   - **Health Check Path**: `/health`
3. Add all environment variables from `backend/.env.example` in the Railway dashboard.

### Frontend Deployment (Vercel)
1. Link your GitHub repository to [Vercel](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. Set the **Framework Preset** to `Vite`.
4. Configure the environment variable:
   - `VITE_API_BASE_URL`: `https://api.yourdomain.com/api/v1`
5. Deploy.

---

## 🗺️ Vision & Future Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KHATA-GST STRATEGIC ROADMAP                         │
└─────────────────────────────────────────────────────────────────────────────┘

  PHASE 1: FOUNDATION & HARDENING [COMPLETED ✅]
  ├── Fastify + TypeScript Monorepo Restructure (backend/ & frontend/)
  ├── Database-Driven RBAC & Immutable Compliance Audit Logging
  ├── Multimodal Gemini Bill OCR with Paise Integer Arithmetic
  ├── Cloudflare R2 / AWS S3 Storage Integration with Local Fallback
  ├── Per-Phone OTP Rate Limiting & Cooldown Protection
  └── Sentry Error Monitoring & DB-Probing /health Endpoint

  PHASE 2: STATUTORY INTELLIGENCE & AI CA COPILOT [ACTIVE 🚀]
  ├── pgvector Statutory Knowledge Retrieval on CGST/SGST Acts
  ├── Autonomous Section 17(5) Blocked Credit Classifier
  ├── Rule 88A ITC Set-Off Optimization & Rule 86B 1% Cash Guard
  └── Conversational AI CA Copilot Workspace for MSMEs

  PHASE 3: CONNECTED BANKING & AUTOMATED TAX ESCROW [NEXT ⏳]
  ├── Open Banking / Account Aggregator API Integration (Setu / Decentro)
  ├── Autonomous Daily Tax Escrow Reserve Calculation
  ├── Real-time GSTR-2B Vendor ITC Matching & Discrepancy Alerts
  └── Automated WhatsApp Vendor Payment & Invoicing Bot

  PHASE 4: FULL AUTONOMOUS CA AGENT [VISION 🔮]
  ├── Direct GSTN API One-Click Live Filing (via licensed GSP/ASP)
  ├── Autonomous Tax Payment Execution via Connected Virtual Accounts
  └── AI Departmental Notice Defense & Scrutiny Response Generator
```

---

## 🛡️ Disaster Recovery & Backups

KhataGST enforces enterprise business continuity standards:
- **Continuous WAL Archiving**: Point-in-time recovery (PITR) up to 30 days via Neon PostgreSQL.
- **Independent Dumps**: Periodic `pg_dump` exports stored in geographically isolated cloud buckets.
- Full step-by-step restoration procedures are documented in [`docs/BACKUP_AND_RECOVERY.md`](file:///c:/Users/HP/OneDrive/Desktop/KhataGST/docs/BACKUP_AND_RECOVERY.md).

---

## 👤 Author & Credits

**Siddharth (btw-itz-sid)**  
*Founder & Lead Architect, KhataGST*  
- GitHub: [@btw-itz-sid](https://github.com/btw-itz-sid)  
- Repository: [github.com/btw-itz-sid/KhataGST](https://github.com/btw-itz-sid/KhataGST)

---

## 📄 License

This project is proprietary and confidential. All rights reserved © 2026 KhataGST.
