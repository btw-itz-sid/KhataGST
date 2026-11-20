<div align="center">

# 🧾 KhataGST

### From scattered invoices to a clearer GST workflow.

AI-assisted bookkeeping, purchase reconciliation, and GST return preparation for Indian small businesses and accountants.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](frontend/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-Full_stack-3178C6?logo=typescript&logoColor=white)](backend/package.json)
[![Fastify](https://img.shields.io/badge/Fastify-API-000000?logo=fastify)](backend/src/index.ts)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-4169E1?logo=postgresql&logoColor=white)](backend/db/migrations)
[![Gemini](https://img.shields.io/badge/Gemini-Invoice_AI-4285F4?logo=google&logoColor=white)](backend/src/services/billScanService.ts)

**[Open demo](https://khata-gst.vercel.app) · [API health](https://khatagst.onrender.com/health) · [API docs](https://khatagst.onrender.com/api/docs)**

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Quick start](#quick-start) · [Deployment](#deployment)

</div>

---

## Overview

KhataGST brings everyday bookkeeping and monthly GST preparation into one workspace. Business owners can capture bills, maintain sales and purchase records, review input tax credit (ITC) suggestions, compare purchases with uploaded GSTR-2B data, and prepare summaries for their accountant or GST portal workflow.

The application combines **AI for document extraction and assistance** with **application code for tax calculations and return aggregation**. Financial amounts use integer paise in the core calculation workflow.

| For business owners | For accountants | For developers |
| --- | --- | --- |
| Capture bills and review business activity | Review reconciliation differences and export working data | React frontend, modular Fastify API, and PostgreSQL schema |
| See credit suggestions and preparation status | Work with GSTR-1 and GSTR-3B summaries | Separate OCR, tax, storage, and knowledge services |

> **Current scope:** KhataGST prepares returns and exports supporting data. It does not submit returns to GSTN, generate a filing ARN, or pay GST. GSTR-2B imports and accept/reject/pending decisions are stored locally; they are not synchronized with the GST portal. AI suggestions require review.

## The workflow

```mermaid
flowchart LR
    A["1 · Capture<br/>Scan a bill or create an invoice"] --> B["2 · Review<br/>Check fields and ITC suggestions"]
    B --> C["3 · Reconcile<br/>Compare purchases with uploaded 2B"]
    C --> D["4 · Prepare<br/>Compute GSTR-1 and GSTR-3B"]
    D --> E["5 · Export<br/>Share working data with your accountant"]
    classDef blue fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef purple fill:#ede9fe,stroke:#7c3aed,color:#2e1065;
    classDef green fill:#dcfce7,stroke:#16a34a,color:#14532d;
    class A blue;
    class B,C purple;
    class D,E green;
```

## Features

| Capability | What is implemented |
| --- | --- |
| **Invoice capture** | Gemini-assisted extraction from JPEG, PNG, WebP, and PDF uploads; 10 MB file limit and a review workflow |
| **Sales and purchases** | Invoice creation, editing, duplication, party records, and tax breakdowns |
| **ITC assistance** | Line-item eligibility suggestions, blocked-credit flags, and expense classification |
| **GSTR-2B reconciliation** | JSON import, books-versus-2B matching, discrepancy summaries, and local accept/reject/pending decisions |
| **Return preparation** | GSTR-1 and GSTR-3B computation, recomputation, and preparation status |
| **Exports** | GSTR-1 Excel workbook, invoice CSV, and a JSON accountant share pack |
| **AI copilot** | GST questions with retrieved knowledge context; semantic retrieval when embeddings are configured and keyword fallback |
| **Business workspace** | Onboarding, dashboard, profile, HSN/SAC rate lookup, usage limits, and compliance nudges |
| **Subscriptions** | Razorpay order and verification routes plus a webhook handler; credentials required |
| **Operations foundation** | JWT authentication, OTP hashes and attempt limits, role middleware, selected audit events, server logging, and database health probe |

**Implementation boundaries:** Role middleware and linked-CA access helpers exist, but permission coverage needs hardening. Audit records are not immutable. Subscription payments are separate from GST tax payments. Export compatibility and tax rules need independent validation before production filing use.

## Architecture

KhataGST is a **monorepo with two deployable applications**: a React SPA and a modular Fastify backend. OCR and reconciliation currently run within API request handlers; durable workers are a proposed next step.

### System map — current implementation

```mermaid
flowchart TB
    USER["Business owner / accountant"]
    subgraph CLIENT["CLIENT · frontend/"]
        UI["React 19 + TypeScript + Vite 8<br/>Dashboard · Invoices · Scan · Reconcile · Returns"]
        API["API client + browser session utilities"]
        UI --> API
    end
    subgraph SERVER["APPLICATION · backend/"]
        HTTP["Fastify HTTP API<br/>JWT · CORS · Rate limiting · Validation"]
        CORE["Business services<br/>Invoices · GST calculations · Returns · Reconciliation"]
        AI["AI services<br/>Bill extraction · Classification · Knowledge retrieval"]
        ADAPTERS["Integration services<br/>Storage · Email · Subscription payments"]
        HTTP --> CORE
        HTTP --> AI
        HTTP --> ADAPTERS
    end
    subgraph DATA["PERSISTENCE"]
        DB[("Neon PostgreSQL<br/>Business records · Returns · 2B imports · Audit events")]
        VECTOR[("pgvector<br/>Seeded knowledge embeddings")]
        FILES[("R2 / S3<br/>Local disk fallback")]
    end
    subgraph PROVIDERS["OPTIONAL EXTERNAL PROVIDERS"]
        GEMINI["Google Gemini<br/>Extraction · Generation · Embeddings"]
        SERVICES["Fast2SMS · Razorpay · Email provider"]
        SENTRY["Sentry initialization<br/>when DSN is configured"]
    end
    USER --> UI
    API -->|"HTTPS · JSON / multipart"| HTTP
    CORE --> DB
    AI --> DB
    AI --> VECTOR
    AI --> GEMINI
    ADAPTERS --> FILES
    ADAPTERS --> SERVICES
    HTTP -.-> SENTRY
    classDef client fill:#dbeafe,stroke:#2563eb,color:#172554;
    classDef app fill:#ede9fe,stroke:#7c3aed,color:#2e1065;
    classDef data fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef external fill:#fef3c7,stroke:#d97706,color:#78350f;
    class UI,API client;
    class HTTP,CORE,AI,ADAPTERS app;
    class DB,VECTOR,FILES data;
    class GEMINI,SERVICES,SENTRY external;
```

Relational records and vectors share one PostgreSQL database. Providers are selected through environment configuration. This diagram describes code boundaries; it does not establish which providers are configured in the demo deployment.

### Invoice capture — request flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React workspace
    participant API as Fastify API
    participant Storage as Storage service
    participant AI as Gemini
    participant DB as PostgreSQL
    User->>UI: Upload purchase bill
    UI->>API: Authenticated multipart request
    API->>API: Check business access and scan allowance
    API->>Storage: Store original document
    API->>DB: Create scan record
    API->>AI: Request structured extraction
    alt Extraction succeeds
        AI-->>API: Extracted bill fields
        API->>API: Normalize data and attach ITC suggestions
    else Extraction unavailable or fails
        API->>API: Create manual-review fallback
    end
    API->>DB: Update scan with extraction or review result
    API-->>UI: Return scan result for review
    User->>UI: Review and correct fields before saving invoice
```

### Code map

```text
KhataGST/
├── frontend/
│   ├── src/pages/             Dashboard, scan, invoices, reconciliation, returns
│   ├── src/components/        Shared UI and error boundary
│   └── src/lib/               API client, session, and state helpers
├── backend/
│   ├── src/routes/            HTTP endpoints and request handling
│   ├── src/services/          Tax, OCR, reconciliation, exports, integrations
│   ├── src/agents/            Expense classifier and ITC decisions
│   ├── src/middleware/        Role checks and audit helper
│   ├── src/lib/               Database, ownership, and OTP utilities
│   ├── src/scripts/           Knowledge embedding seed script
│   ├── db/migrations/         Ordered SQL migrations: 001–009
│   └── test/                  Tax, reconciliation, classifier, helper tests
├── docs/                     Operations guides and sample exports
├── render.yaml               Backend deployment blueprint
└── railway.toml              Alternative backend deployment configuration
```

## Quick start

### 1. Prerequisites

- Node.js **22.12+** and npm; see [Vite's runtime requirements](https://vite.dev/guide/).
- PostgreSQL with the `vector` extension available, such as a configured Neon database.
- PostgreSQL CLI (`psql`) or a SQL editor for migrations.
- A Gemini API key for AI extraction and knowledge embeddings.

```powershell
git clone https://github.com/btw-itz-sid/KhataGST.git
cd KhataGST
```

### 2. Configure the backend

From the repository root:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Edit `backend/.env` and replace the placeholders:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
OTP_MODE=phone_last4
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Generate your own JWT secret; production startup requires at least 32 characters. Full storage, email, payment, and telemetry settings are in [backend/.env.example](backend/.env.example).

**Apply migrations `001` through `009` in filename order to a fresh development database.** The application does not run migrations automatically. From `backend/` in PowerShell:

```powershell
# Set explicitly: psql does not load the application's .env file.
$env:DATABASE_URL = 'YOUR_DEVELOPMENT_DATABASE_CONNECTION_STRING'
Get-ChildItem db/migrations/*.sql | Sort-Object Name | ForEach-Object {
    psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($_.Name)" }
}
```

For an existing database, identify and apply only pending migrations after taking a backup. There is no migration history runner yet.

```powershell
# Optional: populate semantic search embeddings; requires Gemini credentials.
npm run seed:knowledge
npm run dev
```

Backend: [localhost:3000](http://localhost:3000) · [Health](http://localhost:3000/health) · [Swagger UI](http://localhost:3000/api/docs).

### 3. Start the frontend

Open another terminal at the repository root:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

The template sets `VITE_API_BASE_URL=http://localhost:3000/api/v1`. Open the URL Vite prints, normally [localhost:5173](http://localhost:5173).

> **Demo authentication:** With `OTP_MODE=phone_last4`, the code is the phone number's last four digits. This is a demo convenience and does not verify phone ownership. Use synthetic data for demos. Production authentication must use random SMS OTPs and reject demo mode at startup.

### 4. Explore the product

Sign in, onboard a business, create a sale invoice, and scan a purchase bill. Review the extraction, import GSTR-2B JSON on Reconcile, compute return summaries, and download an export. Marking a return **prepared**, including via the legacy `/file` endpoint, does not file it with GSTN.

## Development checks

Run commands from the corresponding application directory:

| Application | Commands | Purpose |
| --- | --- | --- |
| Backend | `npm test` | Existing tax, reconciliation, classifier, OTP, and helper tests |
| Backend | `npm run build` | TypeScript compilation |
| Frontend | `npm run lint` | ESLint checks |
| Frontend | `npm run build` | TypeScript checks and production bundle |

These checks do not establish production security, statutory accuracy, or GST portal acceptance.

## API overview

The API lives under `/api/v1`. Use the [route source](backend/src/routes) alongside [Swagger UI](http://localhost:3000/api/docs); schema coverage varies by route.

| Route group | Responsibility |
| --- | --- |
| `/auth` | OTP requests, verification, profile, and account deletion |
| `/businesses`, `/parties`, `/invoices` | Business records and invoice lifecycle |
| `/scans` | Upload, scan results, and extraction retries |
| `/reconcile` | GSTR-2B imports, matching, and local review decisions |
| `/returns` | Compute, recompute, list, and prepare summaries |
| `/export` | Excel, CSV, and JSON working-data exports |
| `/ai-ca` | Knowledge-assisted questions, classification, and invoice audit |
| `/gst-rates`, `/compliance` | Rate lookup, HSN suggestions, usage, and nudges |
| `/payments`, `/admin` | Subscription payments and administrative views |

## Deployment

The repository includes Vercel frontend and Render backend configuration, with Railway as an alternative. The demo URLs above are project entry points, not uptime guarantees.

| Component | Configuration |
| --- | --- |
| Frontend | Root `frontend`; build `npm run build`; output `dist`; SPA rewrite in `frontend/vercel.json` |
| Backend | Root `backend`; build `npm ci && npm run build`; start `npm start`; health path `/health` |
| Database | Configure `DATABASE_URL` and apply pending migrations separately |
| Browser API URL | Set `VITE_API_BASE_URL=https://YOUR_BACKEND/api/v1` before the frontend build |
| Backend origin | Set `FRONTEND_URL`; review additional CORS defaults in `backend/src/index.ts` |
| Documents | Configure R2 or S3; local fallback is unsuitable for durable production storage |

**Before serving real customer data:** configure live SMS, private document access, production secrets, monitoring, and tested recovery, and validate access controls and payment handling. The checked-in Render blueprint currently enables demo OTP mode and must be changed for production use.

## Project resources

- [Deployment walkthrough and demo smoke test](docs/LIVE_CHECKLIST.md) — includes demo settings; review production configuration before launch.
- [Backup and recovery runbook](docs/BACKUP_AND_RECOVERY.md) — verify provider retention and measure restore results for your deployment.
- [Sample GSTR-1 workbook](docs/samples/GSTR1_2026-03.xlsx)
- [Repository](https://github.com/btw-itz-sid/KhataGST) · [Siddharth / @btw-itz-sid](https://github.com/btw-itz-sid)

---

<div align="center">

**Built for the work between receiving a bill and preparing a return.**

Proprietary project · All rights reserved © 2026 KhataGST.

</div>
