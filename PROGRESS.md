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
| Frontend | React 18 + Vite + TailwindCSS | IN PROGRESS |
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
- [x] React + Vite + Tailwind setup ✅
- [x] Login.tsx — Phone input + OTP screen with useState ✅
- [x] Tailwind @tailwindcss/vite plugin configured ✅

### Day 7 — React Frontend (4 Pages Complete)
- [x] `frontend/src/App.tsx` — full routing with auth guard ✅
  - localStorage token check on mount
  - Auto-redirect: no token → Login, token valid → Dashboard
  - handleLoginSuccess() stores token + businessId + expiry
  - handleLogout() clears localStorage
  - BottomNav shared across all pages
- [x] `frontend/src/pages/Login.tsx` — complete OTP flow ✅
  - Phone input with +91 prefix
  - 6-box OTP entry — auto-advance, backspace, paste support
  - Auto-submit when all 6 digits filled
  - Dev mode OTP hint (shows dev_otp from backend)
  - 30s resend countdown timer
  - onSuccess(token, businessId) prop — wired to App.tsx
  - Auto-fetches business ID after OTP verify
- [x] `frontend/src/pages/Dashboard.tsx` — summary + due dates ✅
  - GSTR-1 + GSTR-3B due date banners with live countdown
  - Color shifts green → orange → red as deadline approaches
  - 4 summary cards: Sales, Purchases, ITC Available, Tax Payable
  - Recent invoices list with GST status badges
  - Falls back to mock data if API unavailable
- [x] `frontend/src/pages/Scan.tsx` — bill scan 4-step flow ✅
  - Step 1: Drag/drop or camera capture upload
  - Step 2: Animated scan line while Claude processes
  - Step 3: Full review form — all fields editable
  - Step 4: Done screen with option to scan another
  - Confidence bar — green 85%+, orange 65–84%, red below 65
  - Falls back to mock extracted data in dev mode
- [x] `frontend/src/pages/Invoices.tsx` — invoice list ✅
  - Live search by party name, invoice number, GSTIN
  - 3 tabs: All / ↑ Sales / ↓ Purchases
  - Sort by: Latest date / Amount / Party A–Z
  - Summary strip showing total sales vs purchases
  - Tap any card → full detail drawer (inline, no new page)
  - GST status badges: Matched / Pending / Mismatch
  - Empty state for no invoices + no search results

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

---

## 🖥️ Frontend Pages — Status

| Page | File | Status | Notes |
|------|------|--------|-------|
| Login | pages/Login.tsx | ✅ DONE | OTP flow, onSuccess prop wired |
| Dashboard | pages/Dashboard.tsx | ✅ DONE | Summary cards, due dates, recent invoices |
| Scan | pages/Scan.tsx | ✅ DONE | 4-step flow, confidence bar, review form |
| Invoices | pages/Invoices.tsx | ✅ DONE | Search, tabs, sort, detail drawer |
| Routing | App.tsx | ✅ DONE | Auth guard, BottomNav, all routes |
| Onboarding | pages/Onboarding.tsx | ⏳ PENDING | 3-step wizard — next session |
| Export | pages/Export.tsx | ⏳ PENDING | Excel/CSV download with month filter |
| Profile | pages/Profile.tsx | ⏳ PENDING | Business settings, plan info, logout |
| Pricing | pages/Pricing.tsx | ⏳ PENDING | Plan cards + Razorpay checkout |

---

## 📋 Important Notes
1. **Amounts always in PAISE** — ₹100 = 10000 paise
2. **JWT field** = `userId` (not `id`)
3. **businesses table** = `owner_id` (not `user_id`)
4. **Bill scan** = USE_MOCK = true in scans.ts
5. **Neon DB** = needs SSL: rejectUnauthorized: false
6. **Frontend folder** = `C:\Users\HP\OneDrive\Desktop\KhataGST\frontend\`
7. **Frontend runs on** = `localhost:5173` (npm run dev)
8. **Backend runs on** = `localhost:3000` (npx tsx src/index.ts)
9. **All pages fall back to mock data** if backend not running



---

## 🏃 How to Run

### Backend
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST
npx tsx src/index.ts
# Server: http://localhost:3000
# Health: http://localhost:3000/health
```

### Frontend
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST\frontend
npm run dev
# App: http://localhost:5173
```

### Folder structure
```
KhataGST\
├── src\                    ← Backend (Node.js + Fastify)
│   ├── routes\
│   ├── services\
│   └── index.ts
└── frontend\               ← Frontend (React + Vite)
    └── src\
        ├── App.tsx          ← Router + auth guard
        └── pages\
            ├── Login.tsx
            ├── Dashboard.tsx
            ├── Scan.tsx
            └── Invoices.tsx
```

---

## 🗺️ REMAINING ROADMAP

### 🔴 Week 7 — Real Bill Scan + Redis (BACKEND)
| Task | Effort | Details |
|------|--------|---------|
| Anthropic API key lena | 0.5 day | console.anthropic.com — pay as you go |
| Cloudflare R2 bucket | 0.5 day | khatagst-bills bucket, free 10GB |
| scans.ts mein USE_MOCK = false | 0.5 day | R2 upload + real Claude Vision call |
| Upstash Redis OTP | 1 day | Production-safe OTP storage |
| Bill scan end-to-end test | 1 day | Real GST invoice photo test karo |

### 🟡 Week 8 — Frontend Remaining Pages
| Page | Effort | Details |
|------|--------|---------|
| Onboarding.tsx | 1 day | 3-step wizard — business name, GST type, state |
| Export.tsx | 0.5 day | Excel/CSV download with month filter |
| Profile.tsx | 0.5 day | Business settings, plan info, logout |
| Pricing.tsx | 1 day | Plan cards + Razorpay checkout |
| Mobile PWA setup | 0.5 day | manifest.json + service worker |

### 🟢 Week 9 — Deploy + Beta Users
| Task | Effort | Details |
|------|--------|---------|
| Railway backend deploy | 1 day | Add all .env vars, health check |
| Vercel frontend deploy | 0.5 day | Connect to Railway API URL |
| End-to-end live test | 0.5 day | Full flow on live URL |
| Find 5 beta users | 2 days | Local dukaan owners — free 30 day access |

### 🟠 Week 10-11 — Monetization
| Task | Effort | Details |
|------|--------|---------|
| Razorpay subscriptions | 2 days | Create order, verify, update plan |
| WhatsApp due date reminders | 1 day | Twilio WABA — Hindi mein |
| First paying customer | — | Target: Week 11 |

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
Day 7    ✅ Frontend 55% — Login, Dashboard, Scan, Invoices, App routing
Week 7   → Real bill scan (Anthropic API key + R2)
Week 8   → Remaining frontend pages (Onboarding, Export, Profile, Pricing)
Week 9   → Deploy (Railway + Vercel) + 5 beta users
Week 11  → First paying customer 💰
Month 3  → 100 paid — break even
Month 12 → 2000+ — seed ready 🚀
```

---

*Last updated: March 22, 2026 — Day 7 complete*
*Backend: 90% | Frontend: 55% | Deployed: No*
*Next session: Onboarding.tsx / Export.tsx / Profile.tsx*
