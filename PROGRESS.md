# KhataGST — Progress Tracker
> Har naye din ka update yha pe likho

---

## 🚀 Project Info
- **Product**: KhataGST — AI-powered GST filing SaaS for Indian MSMEs
- **Founder**: Siddharth (btw-itz-sid)
- **Started**: March 2026
- **Project Path**: `C:\Users\HP\OneDrive\Desktop\KhataGST`
- **GitHub**: https://github.com/btw-itz-sid/KhataGST

---

## 🛠️ Tech Stack
| Layer | Technology | Status |
|-------|-----------|--------|
| Backend | Node.js + Fastify + TypeScript | RUNNING |
| Database | PostgreSQL — Neon (cloud, free tier) | CONNECTED |
| AI | Anthropic Claude API (bill scan) | CODE READY |
| Payments | Razorpay | NOT INTEGRATED |
| WhatsApp | Twilio WABA | NOT INTEGRATED |
| Frontend | React 18 + Vite + TailwindCSS | NOT STARTED |
| Hosting | Railway (backend) + Vercel (frontend) | NOT DEPLOYED |
| Auth | Phone OTP + JWT (30 day token) | WORKING |
| Export | ExcelJS (Excel + CSV) | WORKING |

---

## ✅ Completed — Day by Day

### Day 1 — Idea & Architecture
- [x] Startup idea finalized — GST SaaS for Indian MSMEs
- [x] Product name — KhataGST
- [x] Full system architecture designed (8 layers)
- [x] Database schema designed — 10 tables
- [x] Claude Code agent structure planned (.claude/agents/)
- [x] 35+ agent files created across engineering/product/marketing/design folders
- [x] Tech stack finalized

### Day 2 — Project Setup
- [x] Project folder created — `C:\Users\HP\OneDrive\Desktop\KhataGST`
- [x] Complete folder structure created
- [x] All npm dependencies installed
- [x] Server running on port 3000 ✅
- [x] Health check endpoint — `http://localhost:3000/health`
- [x] CLAUDE.md written — Claude Code brain file
- [x] package.json configured

### Day 3 — Auth API + Core Services
- [x] Phone OTP auth system built
- [x] JWT token generation — 30 day expiry
- [x] `POST /api/v1/auth/send-otp` ✅
- [x] `POST /api/v1/auth/verify-otp` ✅
- [x] `GET /api/v1/auth/me` ✅
- [x] GST Engine service — calculateTax(), validateGSTIN(), isInterState(), getDueDate()
- [x] Bill Scan Service — Claude Vision code written (needs API key)
- [x] dotenv configured

### Day 4 — Database Connected
- [x] PostgreSQL local install failed (Windows admin issues)
- [x] Switched to Neon cloud PostgreSQL — FREE tier ✅
- [x] DATABASE_URL added to .env with SSL config
- [x] db.ts — connection pool with SSL for Neon
- [x] Schema run in Neon SQL Editor — all 10 tables ✅
- [x] Real user saving to DB confirmed ✅
- [x] .gitignore fixed — node_modules removed from GitHub
- [x] PRD v1.0 created (KhataGST_PRD.docx)

### Day 5 — Business + Invoice + Parties APIs
- [x] `src/routes/businesses.ts` — POST, GET, GET/:id ✅
- [x] `src/routes/invoices.ts` — full CRUD ✅
- [x] `src/routes/parties.ts` — full CRUD with GSTIN validation + search ✅
- [x] GST auto-calculation — CGST+SGST intra / IGST inter-state ✅
- [x] All amounts in PAISE ✅
- [x] Tested: INV-001 — ₹10,000 + 18% GST = ₹11,800 ✅
- [x] 2 test parties created in Neon ✅

### Day 6 — GST Returns + Bill Scan + Export
- [x] `src/services/gstr1Service.ts` — B2B/B2C separation, tax totals ✅
- [x] `src/services/gstr3bService.ts` — net tax payable computation ✅
- [x] `src/services/exportService.ts` — Excel + CSV generation ✅
- [x] `src/routes/returns.ts` — GSTR-1 + GSTR-3B routes ✅
- [x] `src/routes/scans.ts` — mock bill scan ✅
- [x] `src/routes/export.ts` — Excel + CSV download ✅
- [x] GSTR-1 tested — due date April 11, B2B/B2C split ✅
- [x] GSTR-3B tested — net payable ₹1,800, due April 20 ✅
- [x] CSV export tested ✅
- [x] Excel export tested — 3 sheets (Summary + B2B + B2C) ✅
- [x] Mock bill scan tested — confidence 83, action "auto" ✅
- [x] return_status enum updated in Neon — added 'ready_to_file' ✅
- [x] ExcelJS installed ✅
- [x] PRD v2.0 updated (KhataGST_PRD_v2.docx)

---

## 🗄️ Database — All 10 Tables Live in Neon

| Table | Status | Test Data |
|-------|--------|-----------|
| users | LIVE | 1 user — phone 9876543210 |
| businesses | LIVE | Test Pvt Ltd — GSTIN 27AABCU9603R1ZX |
| parties | LIVE | Ramesh Traders + Suresh Wholesale |
| invoices | LIVE | INV-001 — ₹11,800 |
| invoice_items | LIVE | 1 item — 18% GST |
| bill_scans | LIVE | 1 mock scan |
| gst_returns | LIVE | GSTR-1 + GSTR-3B March 2026 |
| itc_reconciliation | LIVE | Empty — Phase 2 |
| ca_client_links | LIVE | Empty — Phase 2 |
| payments | LIVE | Empty — Razorpay pending |

---

## 🔄 All APIs — Complete Status

| API | Endpoint | Status |
|-----|----------|--------|
| Auth | POST /api/v1/auth/send-otp | ✅ |
| Auth | POST /api/v1/auth/verify-otp | ✅ |
| Auth | GET /api/v1/auth/me | ✅ |
| Business | POST /api/v1/businesses | ✅ |
| Business | GET /api/v1/businesses | ✅ |
| Invoice | POST/GET/PUT/DELETE /api/v1/invoices | ✅ |
| Parties | POST/GET/PUT/DELETE /api/v1/parties | ✅ |
| Returns | POST /api/v1/returns/gstr1/compute | ✅ |
| Returns | POST /api/v1/returns/gstr3b/compute | ✅ |
| Returns | GET /api/v1/returns | ✅ |
| Scans | POST /api/v1/scans (mock) | ✅ |
| Scans | GET /api/v1/scans/:id | ✅ |
| Export | GET /api/v1/export/excel | ✅ |
| Export | GET /api/v1/export/csv | ✅ |

### Day 6 — React Frontend Setup
- [x] React + Vite + Tailwind setup ✅
- [x] Login.tsx — Phone input + OTP screen with useState ✅
- [x] Tailwind @tailwindcss/vite plugin configured ✅

---

## 📋 Important Notes
1. **Amounts always in PAISE** — ₹100 = 10000 paise
2. **JWT field** = `userId` (not `id`)
3. **businesses table** = `owner_id` (not `user_id`)
4. **Bill scan** = USE_MOCK = true in scans.ts
5. **Neon DB** = needs SSL: rejectUnauthorized: false

## 🔑 Test IDs (Neon mein saved)
```
User ID:     38e6e6eb-fa4f-45a1-a13d-b752c01a0cc6
Business ID: f15b9c5f-5768-4aed-b484-92470d719679
Phone:       9876543210
JWT Token:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGU2ZTZlYi1mYTRmLTQ1YTEtYTEzZC1iNzUyYzAxYTBjYzYiLCJwaG9uZSI6Ijk4NzY1NDMyMTAiLCJwbGFuIjoiZnJlZSIsImlhdCI6MTc3NDE1NDA3OSwiZXhwIjoxNzc2NzQ2MDc5fQ.qDVfIOdiFlxjEdfMJIwIiUrWAEcluhh63M4y9JyZgW8
Token valid till: April 21, 2026
```

---

## 🏃 How to Run
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST
npx tsx src/index.ts
# Server: http://localhost:3000
# Health: http://localhost:3000/health
```

---

## 🗺️ FULL REMAINING ROADMAP

### 🔴 Week 7 — Real Bill Scan + Redis
| Task | Effort | Details |
|------|--------|---------|
| Anthropic API key lena | 0.5 day | console.anthropic.com — pay as you go |
| Cloudflare R2 bucket | 0.5 day | khatagst-bills bucket, free 10GB |
| scans.ts mein USE_MOCK = false | 0.5 day | R2 upload + real Claude Vision call |
| Upstash Redis OTP | 1 day | Production-safe OTP storage |
| Bill scan end-to-end test | 1 day | Real GST invoice photo test karo |

### 🟡 Week 8 — React Frontend
| Page | Effort | Details |
|------|--------|---------|
| React + Vite + Tailwind setup | 0.5 day | /frontend folder |
| Login.tsx | 1 day | Phone input + OTP screen |
| Onboarding.tsx | 1 day | 3-step wizard — business name, GST type, state |
| Dashboard.tsx | 2 days | Summary cards + due date alerts + recent invoices |
| Scan.tsx | 2 days | Camera upload + extracted data review form |

### 🟡 Week 9 — Frontend Complete
| Page | Effort | Details |
|------|--------|---------|
| Invoices.tsx | 1 day | List with search, filter, tabs (Sales/Purchase) |
| Export.tsx | 0.5 day | Excel/CSV download with month filter |
| Profile.tsx | 0.5 day | Business settings, plan info, logout |
| Pricing.tsx | 1 day | Plan cards + Razorpay checkout |
| Mobile PWA setup | 0.5 day | works on phone browser |

### 🟢 Week 10 — Deploy + Beta Users
| Task | Effort | Details |
|------|--------|---------|
| Railway backend deploy | 1 day | Add all .env vars, health check |
| Vercel frontend deploy | 0.5 day | Connect to Railway API URL |
| End-to-end live test | 0.5 day | Full flow on live URL |
| Find 5 beta users | 2 days | Local dukaan owners — free 30 day access |

### 🟠 Week 11-12 — Monetization
| Task | Effort | Details |
|------|--------|---------|
| Razorpay subscriptions | 2 days | Create order, verify, update plan |
| WhatsApp due date reminders | 1 day | Twilio WABA — Hindi mein |
| First paying customer | — | Target: Week 12 |

### 🔵 Phase 2 — After 100 Users
| Task | Details |
|------|---------|
| ITC reconciliation | GSTR-2B mismatch detection |
| CA dashboard | Multi-client management |
| GSTR-9 annual | Year-end filing |
| Android app | React Native |
| E-invoice IRN | GST portal direct |

---

## 📊 Timeline Summary
```
Day 1-6  ✅ Backend complete (90%)
Week 7   → Real bill scan + Redis
Week 8   → React frontend
Week 9   → Frontend complete
Week 10  → Deploy + beta users
Week 12  → First paying customer 💰
Month 3  → 100 paid — break even
Month 12 → 2000+ — seed ready 🚀
```

---

*Last updated: March 22, 2026 — Day 6 complete*
*Backend: 90% | Frontend: 5% | Deployed: No*
*Next session: summary cards (purchases, sales, ITC, tax)*
