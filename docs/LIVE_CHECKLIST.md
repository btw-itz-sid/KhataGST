# KhataGST — Go-Live Checklist

## 1. Code already on `main`
- [x] GST loop + ITC + 2B reconcile + plan limits
- [x] OTP `phone_last4` (SMS later via `OTP_MODE=fast2sms`)
- [x] Privacy / Terms / account delete

## 2. Backend (Railway)
1. New Railway service from this repo (`railway.toml` builds `backend`)
2. Set env vars:
   - `DATABASE_URL` (Neon)
   - `JWT_SECRET` (random ≥32 chars)
   - `OTP_MODE=phone_last4`
   - `FRONTEND_URL=https://YOUR-VERCEL-APP.vercel.app`
   - `NODE_ENV=production`
   - `GEMINI_API_KEY`
   - Prefer R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
   - Optional: `SENTRY_DSN`, Razorpay keys when charging
3. Run migrations `001` → `009` on Neon if not already applied
4. Confirm `GET /health` returns `status: ok`

## 3. Frontend (Vercel)
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
