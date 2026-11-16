# KhataGST — Go-Live Checklist

## 1. Code already on `main`
- [x] GST loop + ITC + 2B reconcile + plan limits
- [x] OTP `phone_last4` (SMS later via `OTP_MODE=fast2sms`)
- [x] Privacy / Terms / account delete

## 2. Backend (Railway) — ⚠️ BLOCKER as of 16 Nov 2026
**Sid's Projects trial is expired** (`Trial Ended` on railway.com/dashboard).  
Services show `0/1 online` until you upgrade Hobby (~$5/mo) or move host.

### Option A — Upgrade Railway (fastest)
1. Dashboard → **Upgrade now** → Hobby plan
2. New service from this repo (`railway.toml` builds `backend`)
3. Set env vars:
   - `DATABASE_URL` (Neon)
   - `JWT_SECRET` (random ≥32 chars)
   - `OTP_MODE=phone_last4`
   - `FRONTEND_URL=https://YOUR-VERCEL-APP.vercel.app`
   - `NODE_ENV=production`
   - `GEMINI_API_KEY`
   - Prefer R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
   - Optional: `SENTRY_DSN`, Razorpay keys when charging
4. Run migrations `001` → `009` on Neon if not already applied
5. Confirm `GET /health` returns `status: ok`

### Option B — Render free/web service (if not paying Railway yet)
1. [render.com](https://render.com) → New Web Service → connect `btw-itz-sid/KhataGST`
2. Root directory: `backend` · Build: `npm install && npm run build` · Start: `node dist/index.js`
3. Same env vars as Railway (Neon `DATABASE_URL`, `JWT_SECRET`, `OTP_MODE=phone_last4`, `GEMINI_API_KEY`, …)
4. Free tier sleeps after idle — fine for demo, not for production customers

## 3. Frontend (Vercel) — can deploy anytime (account already logged in)
1. Root: `frontend`
2. Env: `VITE_API_BASE_URL=https://YOUR-RAILWAY-API.up.railway.app/api/v1`
3. Deploy (SPA rewrite via `vercel.json`)

## 4. Smoke test (15 min)
1. Login with phone → OTP = last 4 digits
2. Onboard business GSTIN
3. Create sale + scan purchase
4. Upload sample 2B JSON on Reconcile
5. Compute GSTR-1 / 3B → download Excel/CA pack
6. Settings → delete account (test user only)

## 5. After first paid user
- Flip `OTP_MODE=fast2sms` + `FAST2SMS_API_KEY`
- Live Razorpay keys + webhook secret
- Custom domain + Privacy/Terms URLs in store listings
