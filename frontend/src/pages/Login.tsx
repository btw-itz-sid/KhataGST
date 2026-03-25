import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { getApiErrorMessage } from "../lib/api";
import type { StoredBusinessContext } from "../lib/session";

interface Props {
  onSuccess: (token: string, business: StoredBusinessContext | null) => void;
}

type Step = "phone" | "otp" | "loading";

const BASE_URL = "/api/v1";
const OTP_LENGTH = 6;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => "");

export default function Login({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanedPhone = phone.replace(/\D/g, "");
  const otpCode = otp.join("");
  const canSendOtp = cleanedPhone.length === 10;
  const canVerifyOtp = otpCode.length === OTP_LENGTH;

  useEffect(() => {
    if (resendTimer <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      setResendTimer((current) => {
        if (current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  async function sendOtp() {
    if (!canSendOtp) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setError(null);
    setStep("loading");

    try {
      const response = await fetch(`${BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, "Unable to send verification code.")
        );
      }

      setStep("otp");
      setResendTimer(30);
      setOtp([...EMPTY_OTP]);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 80);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to reach the server."
      );
      setStep("phone");
    }
  }

  async function verifyOtp() {
    if (!canVerifyOtp) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setError(null);
    setStep("loading");

    try {
      const response = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone, otp: otpCode }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Invalid verification code."));
      }

      const token: string = payload?.data?.token ?? payload?.token ?? "";
      if (!token) throw new Error("Login response is missing a valid token.");

      let business: StoredBusinessContext | null = null;

      try {
        const businessResponse = await fetch(`${BASE_URL}/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const businessPayload = await businessResponse.json().catch(() => null);

        if (businessResponse.ok) {
          const firstBusiness =
            businessPayload?.businesses?.[0] ?? businessPayload?.data?.[0] ?? null;

          if (firstBusiness?.id) {
            business = {
              id: firstBusiness.id,
              name: firstBusiness.legal_name ?? firstBusiness.trade_name ?? "",
            };
          }
        }
      } catch {
        business = null;
      }

      onSuccess(token, business);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Verification could not be completed."
      );
      setStep("otp");
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setError(null);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }

  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (pasted.length !== OTP_LENGTH) return;

    setOtp(pasted.split(""));
    window.setTimeout(() => {
      otpRefs.current[OTP_LENGTH - 1]?.focus();
    }, 80);
  }

  function resetOtpFlow() {
    setStep("phone");
    setOtp([...EMPTY_OTP]);
    setError(null);
  }

  const loadingText =
    otpCode.length === OTP_LENGTH
      ? "Verifying your account..."
      : "Sending verification code...";

  return (
    <>
      <style>{STYLES}</style>

      <div className="auth-shell">
        <section className="auth-showcase">
          {/* Animated floating orbs */}
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="orb orb-three" />
          <div className="mesh-grid" />

          <div className="showcase-content">
            <div className="showcase-brand anim-fade" style={{ animationDelay: "0s" }}>
              Khata<span>GST</span>
            </div>

            <div className="showcase-main">
              <div className="showcase-kicker anim-fade" style={{ animationDelay: "0.15s" }}>
                Operational GST Workspace
              </div>
              <h1 className="anim-fade" style={{ animationDelay: "0.3s" }}>
                Premium filing<br />workflow for<br />modern Indian<br />businesses.
              </h1>
              <p className="anim-fade" style={{ animationDelay: "0.5s" }}>
                Centralize invoice capture, compliance tracking, and export-ready
                reporting in one clean workspace built for MSME operators.
              </p>
            </div>

            <div className="showcase-metrics anim-fade" style={{ animationDelay: "0.65s" }}>
              <div className="metric-card">
                <div className="metric-icon">🔐</div>
                <span>Access</span>
                <strong>OTP sign-in</strong>
              </div>
              <div className="metric-card">
                <div className="metric-icon">📊</div>
                <span>Exports</span>
                <strong>Excel + CSV</strong>
              </div>
              <div className="metric-card">
                <div className="metric-icon">🤖</div>
                <span>Input flow</span>
                <strong>AI invoice scan</strong>
              </div>
            </div>

            <div className="showcase-note anim-fade" style={{ animationDelay: "0.8s" }}>
              Designed for founders, accountants, and teams who need clarity
              before they file.
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card anim-scale">
            <div className="mobile-brand">
              Khata<span>GST</span>
            </div>

            {step === "phone" && (
              <>
                <div className="card-kicker anim-slide" style={{ animationDelay: "0.1s" }}>Sign In</div>
                <h2 className="anim-slide" style={{ animationDelay: "0.2s" }}>Welcome back</h2>
                <p className="card-copy anim-slide" style={{ animationDelay: "0.3s" }}>
                  Enter your mobile number to receive a secure one-time code.
                </p>

                {error && <div className="error-box shake">{error}</div>}

                <label className="field-label anim-slide" style={{ animationDelay: "0.35s" }} htmlFor="phone">
                  Mobile number
                </label>
                <div className="phone-field anim-slide" style={{ animationDelay: "0.4s" }}>
                  <span className="country-pill">+91</span>
                  <input
                    id="phone"
                    className="phone-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                      setError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") sendOtp();
                    }}
                    autoFocus
                  />
                </div>

                <button
                  className="cta-btn anim-slide"
                  style={{ animationDelay: "0.5s" }}
                  onClick={sendOtp}
                  disabled={!canSendOtp}
                >
                  <span className="cta-text">Continue with OTP</span>
                  <span className="cta-shimmer" />
                </button>

                <div className="trust-grid anim-slide" style={{ animationDelay: "0.6s" }}>
                  <div className="trust-item">
                    <div className="trust-icon">🛡️</div>
                    <div>
                      <strong>Secure access</strong>
                      <span>Session issued only after OTP verification.</span>
                    </div>
                  </div>
                  <div className="trust-item">
                    <div className="trust-icon">🏢</div>
                    <div>
                      <strong>Business-aware login</strong>
                      <span>Existing business context is restored after sign-in.</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <div className="card-kicker anim-slide" style={{ animationDelay: "0.05s" }}>Verification</div>
                <h2 className="anim-slide" style={{ animationDelay: "0.15s" }}>Enter your code</h2>
                <p className="card-copy anim-slide" style={{ animationDelay: "0.25s" }}>
                  We sent a 6-digit code to <span className="mono-text">+91 {cleanedPhone}</span>.
                </p>

                {error && <div className="error-box shake">{error}</div>}

                <div className="otp-wrap anim-slide" style={{ animationDelay: "0.35s" }} onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      className={`otp-box ${digit ? "filled" : ""}`}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        handleOtpChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                    />
                  ))}
                </div>

                <button
                  className="cta-btn anim-slide"
                  style={{ animationDelay: "0.45s" }}
                  onClick={verifyOtp}
                  disabled={!canVerifyOtp}
                >
                  <span className="cta-text">Verify and sign in</span>
                  <span className="cta-shimmer" />
                </button>

                <button
                  className="text-btn anim-slide"
                  style={{ animationDelay: "0.5s" }}
                  onClick={resendTimer > 0 ? undefined : sendOtp}
                  disabled={resendTimer > 0}
                >
                  {resendTimer > 0
                    ? `Resend code in ${resendTimer}s`
                    : "Resend verification code"}
                </button>

                <button className="text-btn anim-slide" style={{ animationDelay: "0.55s" }} onClick={resetOtpFlow}>
                  Use another mobile number
                </button>
              </>
            )}

            {step === "loading" && (
              <div className="loading-panel">
                <div className="spinner" />
                <div className="loading-title">{loadingText}</div>
                <div className="loading-copy">
                  Please keep this window open while we complete authentication.
                </div>
              </div>
            )}

            <div className="auth-footer">
              By continuing, you agree to the platform terms and privacy policy.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600;700&display=swap');

  * { box-sizing: border-box; }

  :root {
    --bg: #0a0e1a;
    --surface: rgba(255, 255, 255, 0.04);
    --glass: rgba(255, 255, 255, 0.06);
    --glass-border: rgba(255, 255, 255, 0.1);
    --text: #f1f5f9;
    --text-dark: #0f172a;
    --muted: #94a3b8;
    --soft: #64748b;
    --brand: #ff6b00;
    --brand-light: #ff8a3d;
    --brand-glow: rgba(255, 107, 0, 0.35);
    --brand-surface: rgba(255, 107, 0, 0.08);
    --danger: #ef4444;
    --card-bg: rgba(255, 255, 255, 0.97);
    --card-border: rgba(226, 232, 240, 0.6);
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Shell layout ─────────────────────────────── */
  .auth-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
  }

  /* ── Showcase (left) ──────────────────────────── */
  .auth-showcase {
    position: relative;
    overflow: hidden;
    padding: 48px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 107, 0, 0.15), transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(99, 102, 241, 0.12), transparent 50%),
      linear-gradient(160deg, #0f172a 0%, #0c1222 40%, #131b30 100%);
  }

  /* Animated floating orbs */
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    pointer-events: none;
  }

  .orb-one {
    width: 400px; height: 400px;
    top: -100px; right: -60px;
    background: radial-gradient(circle, rgba(255, 107, 0, 0.4), transparent 70%);
    animation: float-one 12s ease-in-out infinite;
  }

  .orb-two {
    width: 300px; height: 300px;
    bottom: -60px; left: -80px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3), transparent 70%);
    animation: float-two 15s ease-in-out infinite;
  }

  .orb-three {
    width: 200px; height: 200px;
    top: 40%; left: 50%;
    background: radial-gradient(circle, rgba(255, 107, 0, 0.2), transparent 70%);
    animation: float-three 10s ease-in-out infinite;
  }

  @keyframes float-one {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-30px, 40px) scale(1.1); }
    66% { transform: translate(20px, -20px) scale(0.95); }
  }

  @keyframes float-two {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(40px, -30px) scale(1.05); }
    66% { transform: translate(-20px, 40px) scale(0.9); }
  }

  @keyframes float-three {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    50% { transform: translate(-40px, 30px) scale(1.2); opacity: 0.5; }
  }

  /* Subtle grid mesh overlay */
  .mesh-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  }

  .showcase-content {
    position: relative;
    z-index: 2;
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: space-between;
    gap: 24px;
  }

  .showcase-brand, .mobile-brand {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .showcase-brand span, .mobile-brand span {
    background: linear-gradient(135deg, #ff6b00, #ff8a3d);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .showcase-kicker, .card-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .showcase-kicker {
    color: rgba(255, 255, 255, 0.45);
  }

  .showcase-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .showcase-content h1 {
    margin: 14px 0 0;
    font-size: clamp(40px, 5.5vw, 64px);
    line-height: 0.98;
    font-weight: 900;
    letter-spacing: -0.05em;
    background: linear-gradient(180deg, #ffffff 20%, rgba(255,255,255,0.65) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .showcase-content p {
    max-width: 50ch;
    margin: 24px 0 0;
    font-size: 15px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.55);
  }

  .showcase-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .metric-card {
    padding: 18px 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    transition: transform 0.3s ease, border-color 0.3s ease, background 0.3s ease;
  }

  .metric-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255, 107, 0, 0.25);
    background: rgba(255, 255, 255, 0.07);
  }

  .metric-icon {
    font-size: 20px;
    margin-bottom: 10px;
  }

  .metric-card span {
    display: block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
  }

  .metric-card strong {
    font-size: 15px;
    line-height: 1.3;
    color: #fff;
  }

  .showcase-note {
    max-width: 42ch;
    font-size: 13px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.4);
  }

  /* ── Auth panel (right) ───────────────────────── */
  .auth-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 28px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(255, 107, 0, 0.04), transparent 50%),
      linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 440px;
    padding: 36px 32px;
    border-radius: 28px;
    border: 1px solid var(--card-border);
    background: var(--card-bg);
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 24px rgba(0,0,0,0.06),
      0 24px 48px rgba(0,0,0,0.04);
  }

  .mobile-brand {
    display: none;
    margin-bottom: 24px;
    color: var(--text-dark);
  }

  .card-kicker {
    margin-bottom: 8px;
    color: var(--brand);
  }

  .auth-card h2 {
    margin: 0;
    font-size: 32px;
    line-height: 1.05;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-dark);
  }

  .card-copy {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.7;
    color: var(--soft);
  }

  .field-label {
    display: block;
    margin: 28px 0 10px;
    font-size: 12px;
    font-weight: 700;
    color: var(--soft);
    letter-spacing: 0.02em;
  }

  .phone-field {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 16px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .phone-field:focus-within {
    border-color: var(--brand);
    box-shadow:
      0 0 0 4px rgba(255, 107, 0, 0.08),
      0 0 20px rgba(255, 107, 0, 0.06);
  }

  .country-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 54px;
    padding: 11px 12px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(255, 107, 0, 0.08), rgba(255, 107, 0, 0.04));
    color: var(--brand);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 15px;
    font-weight: 700;
  }

  .phone-input {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--text-dark);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: 0.08em;
    outline: none;
  }

  .phone-input::placeholder {
    color: #c1c9d4;
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  /* ── CTA button with shimmer ──────────────────── */
  .cta-btn {
    position: relative;
    overflow: hidden;
    width: 100%;
    margin-top: 20px;
    padding: 16px 20px;
    border: none;
    border-radius: 16px;
    background: linear-gradient(135deg, #ff7a1a 0%, #e8590c 50%, #ff6b00 100%);
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    box-shadow:
      0 8px 20px rgba(234, 88, 12, 0.3),
      0 2px 6px rgba(234, 88, 12, 0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .cta-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 12px 28px rgba(234, 88, 12, 0.35),
      0 4px 10px rgba(234, 88, 12, 0.2);
  }

  .cta-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .cta-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .cta-text {
    position: relative;
    z-index: 1;
  }

  .cta-shimmer {
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.15) 50%,
      transparent 100%
    );
    transition: none;
    pointer-events: none;
  }

  .cta-btn:hover:not(:disabled) .cta-shimmer {
    animation: shimmer 0.8s ease forwards;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  /* ── Trust grid ───────────────────────────────── */
  .trust-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }

  .trust-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .trust-item:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  }

  .trust-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .trust-item strong {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-dark);
  }

  .trust-item span,
  .auth-footer,
  .loading-copy {
    font-size: 12px;
    line-height: 1.6;
    color: var(--soft);
  }

  /* ── OTP inputs ───────────────────────────────── */
  .otp-wrap {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
    margin: 24px 0 16px;
  }

  .otp-box {
    width: 100%;
    min-width: 0;
    height: 58px;
    border-radius: 14px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    text-align: center;
    color: var(--text-dark);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 24px;
    font-weight: 700;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease, background 0.2s ease;
  }

  .otp-box:focus {
    border-color: var(--brand);
    background: rgba(255, 107, 0, 0.03);
    box-shadow:
      0 0 0 4px rgba(255, 107, 0, 0.08),
      0 0 16px rgba(255, 107, 0, 0.05);
  }

  .otp-box.filled {
    border-color: var(--brand-light);
    background: rgba(255, 107, 0, 0.04);
    animation: otp-pop 0.2s ease;
  }

  @keyframes otp-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.06); }
    100% { transform: scale(1); }
  }

  .mono-text {
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 700;
    color: var(--brand);
  }

  .text-btn {
    width: 100%;
    margin-top: 8px;
    padding: 6px 0;
    border: none;
    background: none;
    color: var(--soft);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .text-btn:hover:not(:disabled) {
    color: var(--brand);
  }

  .text-btn:disabled {
    cursor: not-allowed;
    color: #c1c9d4;
  }

  /* ── Error box ────────────────────────────────── */
  .error-box {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid #fecaca;
    background: linear-gradient(135deg, #fef2f2, #fff5f5);
    color: var(--danger);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
  }

  /* ── Loading panel ────────────────────────────── */
  .loading-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 24px 0 8px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid #e2e8f0;
    border-top-color: var(--brand);
    animation: spin 0.7s linear infinite;
  }

  .loading-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--text-dark);
  }

  .auth-footer {
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid #e2e8f0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Entrance animations ──────────────────────── */
  .anim-fade {
    opacity: 0;
    transform: translateY(16px);
    animation: fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes fade-up {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .anim-slide {
    opacity: 0;
    transform: translateY(12px);
    animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes slide-up {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .anim-scale {
    animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes scale-in {
    0% { opacity: 0; transform: scale(0.96); }
    100% { opacity: 1; transform: scale(1); }
  }

  /* ── Shake animation for errors ───────────────── */
  .shake {
    animation: shake 0.4s ease;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  /* ── Responsive ───────────────────────────────── */
  @media (max-width: 1080px) {
    .auth-shell {
      grid-template-columns: 1fr;
    }

    .auth-showcase {
      min-height: 380px;
      padding: 32px 24px;
    }

    .showcase-content {
      justify-content: flex-start;
    }

    .showcase-main {
      flex: 0;
    }

    .showcase-content h1 {
      font-size: 36px;
    }
  }

  @media (max-width: 720px) {
    .auth-panel {
      padding: 20px 14px 36px;
    }

    .auth-card {
      padding: 28px 22px;
      border-radius: 24px;
    }

    .mobile-brand {
      display: block;
    }

    .auth-showcase {
      display: none;
    }

    .auth-card h2 {
      font-size: 28px;
    }

    .otp-wrap {
      gap: 8px;
    }

    .otp-box {
      height: 56px;
      font-size: 22px;
    }
  }
`;
