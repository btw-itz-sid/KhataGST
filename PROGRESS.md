# KhataGST - Progress Tracker
> Latest project snapshot for backend, frontend, auth, AI scan, and deployment readiness.

---

## Project Info
- Product: KhataGST - AI-powered GST filing SaaS for Indian MSMEs
- Founder: Siddharth (btw-itz-sid)
- Started: March 2026
- Project Path: `C:\Users\HP\OneDrive\Desktop\KhataGST`
- GitHub: https://github.com/btw-itz-sid/KhataGST

---

## Current Status
| Layer | Technology | Status |
|-------|------------|--------|
| Backend | Node.js + Fastify + TypeScript | Working |
| Database | Neon PostgreSQL | Connected |
| Auth | Phone OTP + JWT | Working |
| OTP Provider | Fast2SMS (Prod) / Local (Dev) | Working |
| AI Scan | Google Gemini API | Working with structured output + malformed JSON recovery |
| Frontend | React + Vite | Working |
| Export | Excel + CSV | Working |
| Payments | Razorpay | Not integrated |
| Hosting | Railway + Vercel | Not deployed |

---

## Completed Milestones

### Day 1 - Idea and Architecture
- Startup idea finalized: GST SaaS for Indian MSMEs
- Product name finalized: KhataGST
- System architecture planned
- Database schema designed
- Project structure created
- Core stack finalized

### Day 2 - Project Setup
- Backend project initialized
- Frontend Vite app initialized
- TypeScript setup completed
- Fastify server started
- Health endpoint added
- Environment variable flow set up

### Day 3 - Auth and Core Services
- Phone OTP auth flow built
- JWT token generation added
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`
- `GET /api/v1/auth/me`
- GST helper logic added

### Day 4 - Database Connected
- Switched from local PostgreSQL attempt to Neon
- Database schema created in Neon
- Real user creation verified
- Connection pool configured with SSL

### Day 5 - Business, Invoices, Parties
- Business routes completed
- Invoice CRUD completed
- Party CRUD completed
- GST tax calculation logic working
- Paise-based storage enforced

### Day 6 - Returns, Export, Scan Foundation
- GSTR-1 compute flow completed
- GSTR-3B compute flow completed
- Excel export completed
- CSV export completed
- Scan route foundation added

### Day 7 - Frontend Core Screens
- Login page completed
- Dashboard page completed
- Scan page completed
- Invoices page completed
- App-level routing completed
- Bottom navigation added

### Day 8 - Full App Flow Hardening
- Onboarding page completed
- Session storage helpers added
- Login -> onboarding -> dashboard flow fixed
- Business context persistence fixed
- Dashboard, invoices, and scan now use real business context
- Frontend build flow fixed with `vite.config.mjs`
- Root backend TypeScript build fixed
- Default local ports re-verified on `3000` and `5173`

### Day 9 - Security and Reliability Pass
- OTP no longer shown on login page
- OTP API no longer leaks raw OTP by default
- Dev fallback OTP logging moved to `dev-otp.log`
- OTP security hardening completed
- Fallback local OTP mode preserved for development
- Gemini model selection upgraded from legacy hardcode
- Gemini scan response hardened with:
  - supported-model discovery
  - structured JSON schema
  - malformed JSON repair
  - safer frontend error messages
- Scan flow no longer shows fake mock invoice data after real AI failure

### Day 10 - Premium UI and Hardening
- Login and Dashboard redesigned with premium UI (glassmorphism, animations)
- Setup wizard (Onboarding) redesigned with premium split-panel UI
- UUID type error in new business creation fixed (`auth.ts` fallback logic)
- Unauthorized setup access bug fixed (added auth guards to routing logic)

### Day 11 - Production Auth Integration
- Integrated Fast2SMS as real OTP delivery provider for production
- Created `otpService.ts` for environment-aware OTP dispatch setup
- Hardened API to never leak `dev_otp` in responses

---

## Working Features

### Auth
- Phone number based login
- OTP send and verify endpoints working
- JWT token issued after OTP verification
- 30-day auth token support
- Session expiry handling fixed
- Local OTP fallback works in development
- Local OTP-based auth working in development

### Business Setup
- New user onboarding flow completed
- Business creation works from frontend
- Business context stored in local session
- Dashboard redirect logic fixed after onboarding

### Dashboard and Invoices
- Dashboard summary cards working
- Returns overview working
- Invoice list and details working
- Purchase invoice creation from scan flow working

### AI Scan
- Image upload flow working
- Gemini scan route working
- Structured extraction response normalized
- Malformed AI JSON no longer crashes raw `JSON.parse`
- User-facing scan errors are cleaner

### Export and Returns
- GSTR-1 compute route working
- GSTR-3B compute route working
- Excel export working
- CSV export working

---

## API Status
| API | Endpoint | Status |
|-----|----------|--------|
| Auth | POST /api/v1/auth/send-otp | Done |
| Auth | POST /api/v1/auth/verify-otp | Done |
| Auth | GET /api/v1/auth/me | Done |
| Business | POST /api/v1/businesses | Done |
| Business | GET /api/v1/businesses | Done |
| Invoice | POST /api/v1/invoices | Done |
| Invoice | GET /api/v1/invoices | Done |
| Invoice | PUT /api/v1/invoices/:id | Done |
| Invoice | DELETE /api/v1/invoices/:id | Done |
| Parties | CRUD /api/v1/parties | Done |
| Returns | POST /api/v1/returns/gstr1/compute | Done |
| Returns | POST /api/v1/returns/gstr3b/compute | Done |
| Returns | GET /api/v1/returns | Done |
| Scan | POST /api/v1/scans | Done |
| Scan | GET /api/v1/scans/:id | Done |
| Export | GET /api/v1/export/excel | Done |
| Export | GET /api/v1/export/csv | Done |

---

## Frontend Status
| Page | File | Status | Notes |
|------|------|--------|-------|
| Login | `frontend/src/pages/Login.tsx` | Done | OTP login, no OTP leak in UI |
| Onboarding | `frontend/src/pages/Onboarding.tsx` | Done | Business setup wizard |
| Dashboard | `frontend/src/pages/Dashboard.tsx` | Done | Summary cards and due-date data |
| Scan | `frontend/src/pages/Scan.tsx` | Done | Upload, review, save purchase invoice |
| Invoices | `frontend/src/pages/Invoices.tsx` | Done | Search, tabs, invoice details |
| Routing | `frontend/src/App.tsx` | Done | Session-aware route control |
| Export | `frontend/src/pages/Export.tsx` | Pending | UI not built yet |
| Profile | `frontend/src/pages/Profile.tsx` | Pending | Settings and account page pending |
| Pricing | `frontend/src/pages/Pricing.tsx` | Pending | Subscription UX pending |

---

## Recent Verification
- `frontend`: `npm run lint` passed
- `frontend`: `npm run build` passed
- `backend`: `npm run build` passed
- `GET /health` returned `200`
- OTP send/verify flow smoke-tested
- Onboarding create flow smoke-tested
- Invoice create/list flow smoke-tested
- Returns fetch smoke-tested
- Scan route smoke-tested with live Gemini path
- Temporary smoke-test DB records cleaned after verification

---

## Important Notes
1. Monetary amounts are stored in paise.
2. JWT payload uses `userId`.
3. `businesses.owner_id` is the user foreign key.
4. Frontend default dev port is `5173`.
5. Backend default port is `3000`.
6. Vite config now lives at `frontend/vite.config.mjs`.
7. OTP is sent via SMS (prod) or logged locally (dev) and never leaks in UI/API.
8. Integrated Fast2SMS as the production OTP provider.
9. In development, OTP is written to `dev-otp.log`.
10. Gemini scan uses structured JSON output, but parser repair is still kept as a safety layer.

---

## How To Run

### Backend (watch mode)
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST
npm run dev
```

### Backend (compiled mode)
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST
npm run build
npm start
```

### Frontend
```bash
cd C:\Users\HP\OneDrive\Desktop\KhataGST\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### Dev OTP tail
```powershell
Get-Content .\dev-otp.log -Wait
```

---

## AI Scan Hardening & Frontend Completion

## 1. Scan System Updates
- [x] Create `scripts/test-scan.ts` for rapid local AI extraction testing.
- [x] Fix Gemini API payload structure bug (`inlineData` instead of `inline_data`).
- [x] Add "Debug Data" toggle to `Scan.tsx` review screen to display raw JSON output.

## 2. Finish Frontend App Pages
- [x] Verify `Export.tsx` (Completed).
- [x] Implement `Profile.tsx` (Business details & settings).
- [x] Implement `Pricing.tsx` (Subscription plans).
- [x] Update `App.tsx` routing and Dashboard bottom nav for new pages.

## 3. Verification & Deployment
- [x] Verify complete frontend build using `npm run build`.
- [x] Test AI pipeline locally (via testing script).
- [ ] Deploy to Railway (Backend) *[Pending User Decision]*
- [ ] Deploy to Vercel (Frontend) *[Pending User Decision]* deploy
- Production env setup
- End-to-end live smoke test on deployed URLs

### Business
- Beta user onboarding

---

## Remaining Roadmap

### Backend
- Add Redis or Upstash for production-safe OTP/rate limit state
- Add storage layer for uploaded bill images if persistent scan history is needed
- Add stronger scan validation rules for invoice-specific fields

### Frontend
- Build Export page
- Build Profile page
- Build Pricing page
- Add better empty states and retry UX across flows

### DevOps
- Railway backend deploy
- Vercel frontend deploy
- Production env setup
- End-to-end live smoke test on deployed URLs

### Business
- Beta user onboarding
- Subscription flow
- Reminder automation

---

## Timeline Snapshot
```text
Day 1-6  Backend foundation complete
Day 7    Core frontend screens complete
Day 8    App flow hardening complete
Day 9    Security + AI scan reliability pass complete
Day 10   Premium UI redesign (Login, Dashboard, Onboarding) + Bug fixes
Day 11   Production Fast2SMS OTP integration
Next     Export/profile/pricing, deployment
```

---

*Last updated: March 26, 2026*
*Backend: 98% | Frontend: 75% | Deployment: Pending*
*Next focus: export/profile/pricing, remaining frontend screens, deploy*
