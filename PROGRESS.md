# KhataGST — Progress Tracker
> Har naye Claude conversation mein ye file ka content paste karo!

---

## 🚀 Project Info
- **Product**: KhataGST — AI-powered GST filing SaaS for Indian MSMEs
- **Founder**: Siddharth (btw-itz-sid)
- **Started**: March 2026
- **Project Path**: `C:\Users\HP\OneDrive\Desktop\KhataGST`
- **GitHub**: https://github.com/btw-itz-sid/KhataGST

---

## 🛠️ Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Fastify + TypeScript |
| Database | PostgreSQL — Neon (cloud, free tier) |
| AI | Anthropic Claude API (bill scan) |
| Payments | Razorpay |
| WhatsApp | Twilio WABA |
| Frontend | React 18 + Vite + TailwindCSS (not started yet) |
| Hosting | Railway (backend) + Vercel (frontend) |
| Auth | Phone OTP + JWT |

---

## ✅ Completed (Day 1-5)

### Day 1 — Idea & Architecture
- [x] Startup idea finalized — GST SaaS for Indian MSMEs
- [x] Product name — KhataGST
- [x] Full system architecture designed
- [x] Database schema designed — 10 tables
- [x] Claude Code agent structure planned (.claude/agents/)

### Day 2 — Project Setup
- [x] Project folder created — `C:\Users\HP\OneDrive\Desktop\KhataGST`
- [x] Folder structure created:
  ```
  KhataGST/
  ├── .claude/agents/
  ├── db/schema.sql
  ├── src/
  │   ├── index.ts
  │   ├── lib/db.ts
  │   ├── services/gstEngine.ts
  │   ├── services/billScanService.ts
  │   └── routes/
  │       ├── auth.ts
  │       ├── businesses.ts
  │       ├── invoices.ts
  │       └── scans.ts
  ├── .env
  ├── CLAUDE.md
  └── package.json
  ```
- [x] All dependencies installed (`npm install`)
- [x] Server running on port 3000 ✅

### Day 3 — Auth API
- [x] Phone OTP auth system built
- [x] JWT token generation working
- [x] `/api/v1/auth/send-otp` ✅
- [x] `/api/v1/auth/verify-otp` ✅
- [x] `/api/v1/auth/me` ✅
- [x] GST Engine service written (calculateTax, validateGSTIN, getDueDate)
- [x] Bill Scan Service written (Claude Vision API integration)

### Day 4 — Database Connected
- [x] PostgreSQL local install tried (failed — admin issues)
- [x] Switched to Neon (cloud PostgreSQL) — FREE tier
- [x] Neon project created — `khatagst`
- [x] DATABASE_URL added to .env
- [x] Schema run successfully — all 10 tables created ✅
- [x] `dotenv` installed and configured
- [x] Real user saving to database confirmed ✅
- [x] PRD document created (KhataGST_PRD.docx)

### Day 5 — Business & Invoice API
- [x] `src/routes/businesses.ts` — naya file banaya
- [x] `src/routes/invoices.ts` — complete kiya
- [x] Business registration API — POST, GET, GET/:id ✅
- [x] Invoice API — full CRUD (POST, GET, GET/:id, PUT, DELETE) ✅
- [x] GST auto-calculation — CGST+SGST intra-state / IGST inter-state ✅
- [x] Database transactions — invoice + items atomic save ✅
- [x] All amounts in PAISE — no float errors ✅
- [x] Tested: ₹10,000 + 18% GST = ₹11,800 confirmed ✅

---

## 🗄️ Database Tables (All Created in Neon)
1. `users` — app users
2. `businesses` — each GSTIN (owner_id se linked)
3. `parties` — customers & suppliers
4. `invoices` — all GST invoices
5. `invoice_items` — line items per invoice
6. `bill_scans` — AI scan jobs
7. `gst_returns` — GSTR-1, 3B, 9
8. `itc_reconciliation` — ITC matching
9. `ca_client_links` — CA to client
10. `payments` — subscription payments

---

## 🔑 Environment Variables (.env)
```
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-twilight-rain-a1o1cskd-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
JWT_SECRET=khatagst-super-secret-change-this
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_SECRET=xxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PORT=3000
NODE_ENV=development
```

---

## 🔄 APIs Built & Working

### Auth API ✅
| Method | Endpoint | Status |
|--------|----------|--------|
| POST | /api/v1/auth/send-otp | ✅ Working |
| POST | /api/v1/auth/verify-otp | ✅ Working |
| GET | /api/v1/auth/me | ✅ Working |

### Business API ✅
| Method | Endpoint | Status |
|--------|----------|--------|
| POST | /api/v1/businesses | ✅ Working |
| GET | /api/v1/businesses | ✅ Working |
| GET | /api/v1/businesses/:id | ✅ Working |

### Invoice API ✅
| Method | Endpoint | Status |
|--------|----------|--------|
| POST | /api/v1/invoices | ✅ Working |
| GET | /api/v1/invoices | ✅ Working |
| GET | /api/v1/invoices/:id | ✅ Working |
| PUT | /api/v1/invoices/:id | ✅ Working |
| DELETE | /api/v1/invoices/:id | ✅ Working |

### Parties API ⏳
| Method | Endpoint | Status |
|--------|----------|--------|
| POST | /api/v1/parties | 🔄 Next |
| GET | /api/v1/parties | 🔄 Next |
| GET | /api/v1/parties/:id | 🔄 Next |
| PUT | /api/v1/parties/:id | 🔄 Next |

---

## 📋 Business Rules (Important!)
1. **Amounts always in PAISE** — ₹100 = 10000 paise (never float!)
2. **GSTIN** = 15 char alphanumeric
3. **Same state** = CGST + SGST (split equally)
4. **Different state** = IGST only
5. **Free plan** = 1 GSTIN, 50 invoices/month
6. **CA Pro** = unlimited GSTINs, 20 clients
7. **JWT token field** = `userId` (not `id`) ⚠️ Important!
8. **businesses table** = `owner_id` (not `user_id`) ⚠️ Important!

## 💰 GST Rates
- 0%, 5%, 12%, 18%, 28%
- GSTR-1 due: 11th of next month
- GSTR-3B due: 20th of next month
- GSTR-9 due: 31st December

---

## ⏭️ Next Up (Day 6)
- [ ] Parties API (customers & suppliers)
- [ ] Inter-state invoice test karo (IGST)
- [ ] Bill Scan AI feature (Claude Vision)
- [ ] GSTR-1 auto-computation logic

---

## 🔮 Future Roadmap
- [ ] Frontend React dashboard
- [ ] Bill scan AI feature (Claude Vision)
- [ ] GSTR-1 auto-computation
- [ ] ITC reconciliation
- [ ] WhatsApp bot
- [ ] Razorpay subscription
- [ ] CA dashboard

---

## 🏃 How to Run
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST
npx tsx src/index.ts
# Server starts at http://localhost:3000
```

## 🧪 Quick Test
```bash
# Health check
curl http://localhost:3000/health

# Send OTP
curl -X POST http://localhost:3000/api/v1/auth/send-otp -H "Content-Type: application/json" -d "{\"phone\":\"9876543210\"}"

# Verify OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp -H "Content-Type: application/json" -d "{\"phone\":\"9876543210\",\"otp\":\"OTP_HERE\"}"

# Business register
curl -X POST http://localhost:3000/api/v1/businesses -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d "{\"gstin\":\"27AABCU9603R1ZX\",\"legal_name\":\"Test Pvt Ltd\",\"trade_name\":\"TestCo\",\"address\":\"Mumbai MH\",\"state_code\":\"27\"}"

# Invoice create (intra-state CGST+SGST)
curl -X POST http://localhost:3000/api/v1/invoices -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d "{\"business_id\":\"BUSINESS_UUID\",\"invoice_number\":\"INV-001\",\"invoice_date\":\"2026-03-21\",\"invoice_type\":\"sale\",\"place_of_supply\":\"27\",\"items\":[{\"description\":\"Web Design Services\",\"hsn_sac\":\"998314\",\"quantity\":1,\"unit_price_paise\":1000000,\"gst_rate\":18}]}"
```

---

*Last updated: March 21, 2026*
*Next session: Parties API + Bill Scan AI banana hai*
