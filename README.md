[README.md](https://github.com/user-attachments/files/26349357/README.md)
# KhataGST 🧾

> **AI-powered GST filing SaaS for Indian MSMEs**  
> Scan invoices, compute returns, and manage your business finances — all in one place.

![Status](https://img.shields.io/badge/status-v1--ready-brightgreen)
![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Fastify%20%2B%20TypeScript-blue)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)
![Database](https://img.shields.io/badge/database-Neon%20PostgreSQL-4169e1)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-orange)

---

## 📌 What is KhataGST?

KhataGST is a full-stack SaaS product built for small and medium Indian businesses (MSMEs) who struggle with GST compliance. Instead of manual data entry and expensive CA software, KhataGST lets business owners:

- 📸 **Scan invoices** using AI (Google Gemini) to auto-extract GST data
- 📊 **Compute GSTR-1 & GSTR-3B** returns automatically
- 🏢 **Manage businesses, invoices, and parties** with a clean mobile-first UI
- 📤 **Export data** to Excel and CSV for filing or records
- 🔐 **Authenticate securely** via Phone OTP (no passwords)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Fastify + TypeScript |
| Database | Neon PostgreSQL (with SSL connection pooling) |
| Auth | Phone OTP via Fast2SMS + JWT |
| AI / Scan | Google Gemini API (structured JSON extraction) |
| Frontend | React + Vite + TypeScript |
| Export | Excel + CSV |
| Payments *(planned)* | Razorpay |
| Hosting *(planned)* | Railway (backend) + Vercel (frontend) |

---

## ✨ Features

- **Phone OTP Login** — No passwords. OTP delivered via Fast2SMS in production.
- **AI Invoice Scanning** — Upload a photo or PDF of an invoice; Gemini extracts GSTIN, amounts, tax breakdowns, and party details automatically.
- **GST Returns Engine** — Compute GSTR-1 (outward supplies) and GSTR-3B (summary returns) from your invoice data.
- **Invoice Management** — Full CRUD with GST tax calculation, paise-based precision storage, and party linking.
- **Business & Party Management** — Multi-business support with complete party (customer/supplier) tracking.
- **Excel & CSV Export** — Download your data for offline filing or CA handoff.
- **Premium Glassmorphic UI** — Mobile-first, dark glass UI with animated components, fully responsive across mobile, tablet, and desktop.
- **Session-Aware Routing** — Protected routes with business context persistence across sessions.

---

## 📂 Project Structure

```
KhataGST/
├── backend/
│   ├── src/
│   │   ├── routes/         # Auth, Business, Invoice, Party, Returns, Scan, Export
│   │   ├── db/             # Neon PostgreSQL schema & connection pool
│   │   ├── services/       # Gemini AI, GST compute logic, OTP
│   │   └── server.ts       # Fastify app entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # Login, Onboarding, Dashboard, Scan, Invoices, Export, Profile, Pricing
│   │   ├── components/     # Shared UI components
│   │   └── App.tsx         # Routing & session logic
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Fast2SMS](https://fast2sms.com) API key (for OTP)
- A [Google Gemini](https://ai.google.dev) API key (for AI scanning)

### 1. Clone the repo

```bash
git clone https://github.com/btw-itz-sid/KhataGST.git
cd KhataGST
```

### 2. Set up the Backend

```bash
cd backend
npm install
```

Create a `.env` file in `/backend`:

```env
DATABASE_URL=your_neon_postgres_connection_string
FAST2SMS_API_KEY=your_fast2sms_api_key
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_secret
PORT=3000
NODE_ENV=development
```

Run the backend:

```bash
npm run dev       # Development
npm run build     # Production build
```

### 3. Set up the Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `/frontend`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Run the frontend:

```bash
npm run dev       # Development
npm run build     # Production build
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/send-otp` | Send OTP to phone number |
| POST | `/api/v1/auth/verify-otp` | Verify OTP & receive JWT |
| GET | `/api/v1/auth/me` | Get current authenticated user |

### Business
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/businesses` | Create a business |
| GET | `/api/v1/businesses` | List user's businesses |
| PUT | `/api/v1/businesses/:id` | Update business profile |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices` | List invoices |
| PUT | `/api/v1/invoices/:id` | Update invoice |
| DELETE | `/api/v1/invoices/:id` | Delete invoice |

### GST Returns
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/returns/gstr1/compute` | Compute GSTR-1 |
| POST | `/api/v1/returns/gstr3b/compute` | Compute GSTR-3B |
| GET | `/api/v1/returns` | List filed/computed returns |

### AI Scan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/scans` | Upload & AI-scan an invoice |
| GET | `/api/v1/scans/:id` | Get scan result |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/export/excel` | Download Excel export |
| GET | `/api/v1/export/csv` | Download CSV export |

---

## 🗺️ Roadmap

### ✅ V1 — Core Product (Complete)
- Phone OTP auth, JWT sessions
- Business, Invoice, Party management
- AI invoice scanning via Gemini
- GSTR-1 & GSTR-3B compute engine
- Excel / CSV export
- Full responsive premium UI

### 🔄 Phase 1 — Deployment (In Progress)
- [ ] Deploy backend on Railway
- [ ] Deploy frontend on Vercel
- [ ] Map custom domain (`app.khatagst.com`)

### 📦 Phase 2 — Post-Launch Polish
- [ ] Invoice image storage (AWS S3 / Cloudflare R2)
- [ ] Email / WhatsApp receipts (AWS SES / Gupshup)
- [ ] PWA support (manifest + service workers)

### 💳 Phase 3 — Monetization
- [ ] Razorpay payment integration
- [ ] Free vs Pro plan enforcement via API
- [ ] Subscription webhooks & access gating

### 🏢 Phase 4 — Enterprise (V2)
- [ ] CA Portal — manage multiple businesses under one account
- [ ] Government GSTIN API integration for one-click live filing

---

## 🔐 Environment Variables Summary

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Backend | Neon PostgreSQL connection string |
| `FAST2SMS_API_KEY` | Backend | OTP delivery (production) |
| `GEMINI_API_KEY` | Backend | Google Gemini AI for invoice scanning |
| `JWT_SECRET` | Backend | JWT signing secret |
| `VITE_API_BASE_URL` | Frontend | Backend API base URL |

---

## 👤 Author

**Siddharth** — [@btw-itz-sid](https://github.com/btw-itz-sid)  
Built from scratch in March 2026. 12 days. 0 to V1. 🚀

---

## 📄 License

This project is private and proprietary. All rights reserved © 2026 KhataGST.
