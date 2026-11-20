import "./Login.css";
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
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

// Login ka flow — teen steps hain
type Step = "phone" | "otp" | "loading";

import { BASE_URL } from "../lib/api";

// Abhi OTP = phone ke last 4 digits (SMS API baad mein)

const emptyOtp = (length:number) => Array.from({length},()=>"");

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
    text: "GSTR-1 & GSTR-3B preview for your CA",
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
export default function Login({ onSuccess, onOpenPrivacy, onOpenTerms }: Props) {
  // Current step — phone → otp → loading
  const [step, setStep] = useState<Step>("phone");

  // Phone number state
  const [phone, setPhone] = useState("");

  // OTP digits array (6 separate inputs)
  const [otp, setOtp] = useState<string[]>(emptyOtp(4));

  const [otpMode,setOtpMode]=useState("phone_last4");

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
  const canSendOtp = /^[6-9]\d{9}$/.test(cleanedPhone);
  const canVerifyOtp = otpCode.length === otp.length;

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
      setResendTimer(60);
      setOtpMode(payload?.data?.otp_mode === "fast2sms" ? "fast2sms" : "phone_last4");
      setOtp(emptyOtp(payload?.data?.otp_length === 6 ? 6 : 4));
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Server se connect nahi ho paya.");
      setStep("phone");
    }
  }

  // ── OTP verify karo ─────────────────────────────────────────────────
  async function verifyOtp() {
    if (!canVerifyOtp) {
      setError("4-digit OTP enter karo (number ke last 4 digits).");
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
    if (digit && index < otp.length - 1) {
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
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, otp.length);
    if (pasted.length !== otp.length) return;
    setOtp(pasted.split(""));
    setTimeout(() => otpRefs.current[otp.length - 1]?.focus(), 80);
  }

  // Phone step pe wapas jao
  function resetOtpFlow() {
    setStep("phone");
    setOtp(emptyOtp(otp.length));
    setError(null);
  }

  return (
    <>


      <div className="auth-wrap auth-layout">

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
              GST books and return prep<br />for Indian MSMEs.
            </h1>
            <p className="brand-desc">
              From invoice capture to GSTR preview — manage your GST
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
                {error && <div className="error-box" role="alert">{error}</div>}

                {/* Phone input */}
                <label className="field-label" htmlFor="phone-input">
                  Mobile Number
                </label>
                <div className="phone-row">
                  <span className="country-code">+91</span>
                  <input
                    id="phone-input"
                    onKeyDown={e=>{if(e.key==="Enter"&&canSendOtp)void sendOtp();}}
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
                  <button type="button" className="auth-link" onClick={onOpenTerms}>
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button type="button" className="auth-link" onClick={onOpenPrivacy}>
                    Privacy Policy
                  </button>
                  .
                </p>
              </>
            )}

            {/* ── STEP: OTP ───────────────────────────────────────────── */}
            {step === "otp" && (
              <>
                <div className="auth-eyebrow">Verify</div>
                <h2 className="auth-title">Enter OTP</h2>
                <p className="auth-desc">{otpMode==="phone_last4" ? <>Local demo: enter the last four digits of +91 {cleanedPhone}.</> : <>Enter the {otp.length}-digit verification code sent to +91 {cleanedPhone}.</>}</p>

                {/* Error */}
                {error && <div className="error-box" role="alert">{error}</div>}

                {/* 6-digit OTP boxes */}
                <div
                  className="otp-grid"
                  style={{gridTemplateColumns:`repeat(${otp.length}, minmax(0,1fr))`}}
                  onPaste={handleOtpPaste}
                  aria-label="OTP input"
                >
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      aria-label={`Verification code digit ${i+1}`}
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
                  {otpCode.length === otp.length
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
