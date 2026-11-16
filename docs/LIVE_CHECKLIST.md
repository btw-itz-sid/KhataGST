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

### Option B — Render free (chosen path)
Open: https://dashboard.render.com/web/new → connect **`btw-itz-sid/KhataGST`**

| Field | Value |
|---|---|
| Name | `khatagst-api` |
| Language | Node |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `node dist/index.js` |
| Instance | **Free** `$0` (0.1 CPU / 512 MB) |

**Environment Variables** (Add from `.env` or paste):
- `NODE_ENV` = `production`
- `OTP_MODE` = `phone_last4`
- `DATABASE_URL` = (from `backend/.env` Neon URL)
- `JWT_SECRET` = (same as local, must be ≥32 chars)
- `GEMINI_API_KEY` = (from `backend/.env`)
- `FRONTEND_URL` = (set after Vercel URL is known, e.g. `https://khatagst.vercel.app`)

Then **Deploy web service**. Wait for live URL like `https://khatagst-api.onrender.com`  
Test: `https://khatagst-api.onrender.com/health` → should show `status: ok` (first hit may take ~30–60s cold start).

Free tier sleeps after idle — fine for demo.

## 3. Frontend (Vercel) — free
1. https://vercel.com/new → Import `btw-itz-sid/KhataGST`
2. **Root Directory:** `frontend`
3. Framework: Vite
4. Env: `VITE_API_BASE_URL` = `https://YOUR-RENDER-SERVICE.onrender.com/api/v1`
5. Deploy (SPA rewrite already in `frontend/vercel.json`)
6. Copy Vercel URL → paste back into Render as `FRONTEND_URL` → Manual Deploy

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
