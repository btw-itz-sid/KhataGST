// ─────────────────────────────────────────────────────────────────────────────
// Login.tsx — KhataGST ka Authentication Page
// Phone number enter karo → OTP aata hai → verify → dashboard
// Clean 2-panel layout: left side branding, right side form
// Koi mock data nahi — sab real API se
// ─────────────────────────────────────────────────────────────────────────────

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { getApiErrorMessage } from "../lib/api";
import type { StoredBusinessContext } from "../lib/session";

// Props — parent App.tsx se onSuccess milta hai
interface Props {
  onSuccess: (token: string, business: StoredBusinessContext | null) => void;
}

// Login ka flow — teen steps hain
type Step = "phone" | "otp" | "loading";

import { BASE_URL } from "../lib/api";

// OTP kitne digits ka hai
const OTP_LENGTH = 6;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => "");

// KhataGST ke features jo left panel mein dikhenge
const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
      </svg>
    ),
    text: "AI-powered GST invoice scanning",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    text: "Automatic GSTR-1 & ITR filing prep",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
        <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
      </svg>
    ),
    text: "One-click Excel & CSV export",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    text: "Real-time compliance dashboard",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Login Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Login({ onSuccess }: Props) {
  // Current step — phone → otp → loading
  const [step, setStep] = useState<Step>("phone");

  // Phone number state
  const [phone, setPhone] = useState("");

  // OTP digits array (6 separate inputs)
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);

  // Error message
  const [error, setError] = useState<string | null>(null);

  // Resend OTP timer (30 second countdown)
  const [resendTimer, setResendTimer] = useState(0);

  // OTP input boxes ke refs — auto-focus ke liye
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleaned phone (sirf digits)
  const cleanedPhone = phone.replace(/\D/g, "");
  const otpCode = otp.join("");
  const canSendOtp = cleanedPhone.length === 10;
  const canVerifyOtp = otpCode.length === OTP_LENGTH;

  // ── Resend timer countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(() => {
      setResendTimer((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resendTimer]);

  // ── OTP bhejo phone pe ───────────────────────────────────────────────
  async function sendOtp() {
    if (!canSendOtp) {
      setError("Valid 10-digit mobile number enter karo.");
      return;
    }
    setError(null);
    setStep("loading");
    try {
      const res = await fetch(`${BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "OTP send nahi ho paya."));
      setStep("otp");
      setResendTimer(30);
      setOtp([...EMPTY_OTP]);
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Server se connect nahi ho paya.");
      setStep("phone");
    }
  }

  // ── OTP verify karo ─────────────────────────────────────────────────
  async function verifyOtp() {
    if (!canVerifyOtp) {
      setError("6-digit OTP enter karo.");
      return;
    }
    setError(null);
    setStep("loading");
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone, otp: otpCode }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Invalid OTP."));

      // Token nikalo
      const token: string = payload?.data?.token ?? payload?.token ?? "";
      if (!token) throw new Error("Login response mein token missing hai.");

      // Business info fetch karo
      let business: StoredBusinessContext | null = null;
      try {
        const bRes = await fetch(`${BASE_URL}/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const bPayload = await bRes.json().catch(() => null);
        if (bRes.ok) {
          const first = bPayload?.businesses?.[0] ?? bPayload?.data?.[0] ?? null;
          if (first?.id) {
            business = {
              id: first.id,
              name: first.legal_name ?? first.trade_name ?? "",
            };
          }
        }
      } catch {
        business = null;
      }

      // Successfully logged in!
      onSuccess(token, business);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification fail ho gayi.");
      setStep("otp");
    }
  }

  // ── OTP input handlers ───────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setError(null);
    // Next box pe focus karo
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    // Backspace pe previous box pe jao
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // OTP paste handle karo — SMS se directly paste ho sake
  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length !== OTP_LENGTH) return;
    setOtp(pasted.split(""));
    setTimeout(() => otpRefs.current[OTP_LENGTH - 1]?.focus(), 80);
  }

  // Phone step pe wapas jao
  function resetOtpFlow() {
    setStep("phone");
    setOtp([...EMPTY_OTP]);
    setError(null);
  }

  return (
    <>
      <style>{STYLES}</style>

      <div className="auth-wrap">

        {/* ── LEFT PANEL — Branding ───────────────────────────────────── */}
        <div className="brand-panel">
          {/* Logo */}
          <div className="brand-logo">
            Khata<span>GST</span>
          </div>

          {/* Headline */}
          <div className="brand-content">
            <p className="brand-eyebrow">GST Compliance Platform</p>
            <h1 className="brand-headline">
              Smart GST filing<br />for Indian MSMEs.
            </h1>
            <p className="brand-desc">
              From invoice capture to GSTR export — manage your entire GST
              compliance workflow in one clean, fast workspace.
            </p>

            {/* Feature checklist */}
            <ul className="feature-list">
              {FEATURES.map((f, i) => (
                <li key={i} className="feature-item">
                  <span className="feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer note */}
          <p className="brand-footer">
            Built for founders, accountants &amp; MSMEs.
          </p>
        </div>

        {/* ── RIGHT PANEL — Auth Form ─────────────────────────────────── */}
        <div className="form-panel">
          <div className="auth-card">

            {/* Mobile logo (sirf mobile pe dikhega) */}
            <div className="mobile-logo">Khata<span>GST</span></div>

            {/* ── STEP: PHONE ─────────────────────────────────────────── */}
            {step === "phone" && (
              <>
                <div className="auth-eyebrow">Sign In</div>
                <h2 className="auth-title">Welcome back</h2>
                <p className="auth-desc">
                  Enter your registered mobile number to receive a one-time verification code.
                </p>

                {/* Error message */}
                {error && <div className="error-box">{error}</div>}

                {/* Phone input */}
                <label className="field-label" htmlFor="phone-input">
                  Mobile Number
                </label>
                <div className="phone-row">
                  <span className="country-code">+91</span>
                  <input
                    id="phone-input"
                    className="phone-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    autoFocus
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                      setError(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") sendOtp(); }}
                  />
                </div>

                {/* Send OTP button */}
                <button
                  className="primary-btn"
                  onClick={sendOtp}
                  disabled={!canSendOtp}
                >
                  Send Verification Code →
                </button>

                {/* Terms */}
                <p className="auth-terms">
                  By continuing, you agree to our{" "}
                  <a href="#" className="auth-link">Terms of Service</a> and{" "}
                  <a href="#" className="auth-link">Privacy Policy</a>.
                </p>
              </>
            )}

            {/* ── STEP: OTP ───────────────────────────────────────────── */}
            {step === "otp" && (
              <>
                <div className="auth-eyebrow">Verify</div>
                <h2 className="auth-title">Enter your code</h2>
                <p className="auth-desc">
                  We sent a 6-digit code to <strong>+91 {cleanedPhone}</strong>.
                  Check your SMS.
                </p>

                {/* Error */}
                {error && <div className="error-box">{error}</div>}

                {/* 6-digit OTP boxes */}
                <div
                  className="otp-grid"
                  onPaste={handleOtpPaste}
                  aria-label="OTP input"
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      className={`otp-box ${digit ? "otp-filled" : ""}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                {/* Verify button */}
                <button
                  className="primary-btn"
                  onClick={verifyOtp}
                  disabled={!canVerifyOtp}
                >
                  Verify &amp; Sign In
                </button>

                {/* Resend OTP */}
                <div className="resend-row">
                  {resendTimer > 0 ? (
                    <span className="resend-timer">Resend in {resendTimer}s</span>
                  ) : (
                    <button className="resend-btn" onClick={sendOtp}>
                      Resend Code
                    </button>
                  )}
                  <span className="dot-sep">·</span>
                  <button className="resend-btn" onClick={resetOtpFlow}>
                    Change Number
                  </button>
                </div>
              </>
            )}

            {/* ── STEP: LOADING ───────────────────────────────────────── */}
            {step === "loading" && (
              <div className="loading-state">
                <div className="auth-spinner" />
                <p className="loading-text">
                  {otpCode.length === OTP_LENGTH
                    ? "Verifying your account…"
                    : "Sending verification code…"}
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Clean SaaS two-panel auth design
// Left: dark branding, Right: white form card
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;background:#f9fafb}
button,input{font-family:inherit;outline:none;cursor:pointer;border:none}
a{color:inherit;text-decoration:none}

/* ── Auth Layout — 2 panels ─────────────────────────────────────────────── */
.auth-wrap{
  display:grid;
  grid-template-columns:1fr 1fr;
  min-height:100vh;
}

/* ── LEFT PANEL — Dark branding ─────────────────────────────────────────── */
.brand-panel{
  background:#0f172a;
  color:#fff;
  padding:48px;
  display:flex;
  flex-direction:column;
  gap:0;
  position:relative;
  overflow:hidden;
}
.brand-panel::before{
  content:'';position:absolute;
  top:-120px;right:-80px;
  width:400px;height:400px;border-radius:50%;
  background:radial-gradient(circle,rgba(249,115,22,.12),transparent 70%);
  pointer-events:none;
}
.brand-logo{
  font-family:'JetBrains Mono',monospace;
  font-size:22px;font-weight:700;color:#fff;
  margin-bottom:auto;
}
.brand-logo span{color:#f97316}

.brand-content{
  padding:40px 0;
  display:flex;flex-direction:column;gap:20px;
}
.brand-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:#f97316;
}
.brand-headline{
  font-size:clamp(28px,3.5vw,42px);
  font-weight:800;line-height:1.1;letter-spacing:-.03em;
  color:#fff;
}
.brand-desc{
  font-size:15px;line-height:1.7;color:rgba(255,255,255,.55);
  max-width:40ch;
}

/* Feature list */
.feature-list{list-style:none;display:flex;flex-direction:column;gap:14px}
.feature-item{
  display:flex;align-items:center;gap:12px;
  font-size:14px;color:rgba(255,255,255,.75);
}
.feature-icon{
  width:36px;height:36px;border-radius:8px;
  background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);
  display:flex;align-items:center;justify-content:center;
  color:#f97316;flex-shrink:0;
}

.brand-footer{
  font-size:12px;color:rgba(255,255,255,.3);
  margin-top:auto;padding-top:32px;
}

/* ── RIGHT PANEL — Auth Form ─────────────────────────────────────────────── */
.form-panel{
  background:#f9fafb;
  display:flex;align-items:center;justify-content:center;
  padding:32px 24px;
}
.auth-card{
  background:#fff;border:1px solid #e5e7eb;
  border-radius:16px;padding:36px 32px;
  width:100%;max-width:420px;
  display:flex;flex-direction:column;gap:16px;
}
.mobile-logo{
  display:none;
  font-family:'JetBrains Mono',monospace;
  font-size:20px;font-weight:700;color:#111827;
  margin-bottom:8px;
}
.mobile-logo span{color:#f97316}

/* Card header text */
.auth-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:#9ca3af;
}
.auth-title{font-size:22px;font-weight:800;color:#111827;letter-spacing:-.02em}
.auth-desc{font-size:14px;color:#6b7280;line-height:1.6}

/* Error box */
.error-box{
  padding:11px 14px;border-radius:8px;
  background:#fee2e2;border:1px solid #fca5a5;
  color:#991b1b;font-size:13px;font-weight:500;
}

/* Phone input */
.field-label{font-size:13px;font-weight:600;color:#374151}
.phone-row{
  display:flex;align-items:center;
  border:1.5px solid #e5e7eb;border-radius:9px;
  background:#fff;overflow:hidden;
  transition:border-color .15s,box-shadow .15s;
}
.phone-row:focus-within{
  border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.1);
}
.country-code{
  padding:12px 14px;
  font-size:14px;font-weight:700;color:#374151;
  border-right:1.5px solid #e5e7eb;background:#f9fafb;
  flex-shrink:0;
}
.phone-input{
  flex:1;padding:12px 14px;border:none;
  font-size:15px;font-weight:600;color:#111827;background:transparent;
  letter-spacing:.04em;
}
.phone-input::placeholder{color:#9ca3af;font-weight:400;letter-spacing:0}

/* Primary CTA button */
.primary-btn{
  width:100%;padding:13px 20px;border-radius:9px;
  background:#f97316;color:#fff;
  font-size:15px;font-weight:700;border:none;cursor:pointer;
  box-shadow:0 1px 3px rgba(249,115,22,.3);
  transition:all .15s;
}
.primary-btn:hover:not(:disabled){
  background:#ea580c;
  box-shadow:0 6px 20px rgba(249,115,22,.4);
  transform:translateY(-1px);
}
.primary-btn:disabled{
  opacity:.4;cursor:not-allowed;transform:none;
}

/* Terms */
.auth-terms{font-size:12px;color:#9ca3af;line-height:1.6;text-align:center}
.auth-link{color:#f97316;text-decoration:underline}

/* OTP Grid */
.otp-grid{
  display:grid;grid-template-columns:repeat(6,1fr);
  gap:8px;
}
.otp-box{
  width:100%;min-width:0;aspect-ratio:1;border-radius:9px;
  border:1.5px solid #e5e7eb;background:#f9fafb;
  font-size:20px;font-weight:800;color:#111827;
  text-align:center;transition:all .15s;
  font-family:'JetBrains Mono',monospace;
}
.otp-box:focus{
  border-color:#f97316;background:#fff;
  box-shadow:0 0 0 3px rgba(249,115,22,.1);outline:none;
}
.otp-filled{background:#fff7f5;border-color:#fed7aa}

/* Resend row */
.resend-row{
  display:flex;align-items:center;justify-content:center;
  gap:10px;font-size:13px;
}
.resend-timer{color:#9ca3af;font-weight:500}
.resend-btn{
  background:none;border:none;padding:0;
  font-size:13px;font-weight:600;color:#f97316;cursor:pointer;
  transition:color .15s;
}
.resend-btn:hover{color:#ea580c}
.dot-sep{color:#d1d5db}

/* Loading state */
.loading-state{
  display:flex;flex-direction:column;align-items:center;
  gap:14px;padding:20px 0;
}
.auth-spinner{
  width:36px;height:36px;border-radius:50%;
  border:3px solid #e5e7eb;border-top-color:#f97316;
  animation:spin .7s linear infinite;
}
.loading-text{font-size:14px;color:#6b7280;text-align:center}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:768px){
  .auth-wrap{grid-template-columns:1fr}
  .brand-panel{display:none}
  .form-panel{padding:24px 16px;min-height:100vh;background:#f9fafb}
  .auth-card{box-shadow:none;border:none;padding:28px 20px}
  .mobile-logo{display:block}
}
@media(max-width:400px){
  .otp-grid{gap:6px}
  .otp-box{font-size:18px}
  .auth-card{padding:20px 16px}
}
`;
