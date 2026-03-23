import { useState, useRef, useEffect } from "react";
import { getApiErrorMessage } from "../lib/api";
import type { StoredBusinessContext } from "../lib/session";

interface Props {
  onSuccess: (token: string, business: StoredBusinessContext | null) => void;
}

type Step = "phone" | "otp" | "loading";

const BASE_URL = "/api/v1";

export default function Login({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((t) => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current!);
  }, [resendTimer]);

  async function sendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) { setError("10 digit ka valid phone number daalo"); return; }
    setError(null);
    setStep("loading");
    try {
      const res = await fetch(`${BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "OTP send karne mein problem"));
      }

      setStep("otp");
      setResendTimer(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Server se connect nahi ho pa raha"
      );
      setStep("phone");
    }
  }

  async function verifyOtp() {
    const code = otp.join("");
    if (code.length !== 6) { setError("6 digit ka OTP daalo"); return; }
    setError(null);
    setStep("loading");
    try {
      const cleaned = phone.replace(/\D/g, "");
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, otp: code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(data, "OTP galat hai"));
      }

      const token: string = data?.data?.token ?? data?.token ?? "";
      if (!token) throw new Error("Login response mein token missing hai");

      let business: StoredBusinessContext | null = null;
      try {
        const bizRes = await fetch(`${BASE_URL}/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const bizData = await bizRes.json().catch(() => null);
        if (bizRes.ok) {
          const firstBusiness = bizData?.businesses?.[0] ?? bizData?.data?.[0] ?? null;
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
        err instanceof Error ? err.message : "OTP verify nahi ho pa raha"
      );
      setStep("otp");
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError(null);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (digit && index === 5) {
      const filled = [...newOtp.slice(0, 5), digit];
      if (filled.every((d) => d !== "")) { setOtp(filled); setTimeout(verifyOtp, 80); }
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split("")); otpRefs.current[5]?.focus(); setTimeout(verifyOtp, 80); }
  }

  function goBack() {
    setStep("phone"); setOtp(["", "", "", "", "", ""]); setError(null);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Space+Mono:wght@700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#f5f3ef;--surface:#fff;--border:#e5e1d8;--tx:#1a1611;--ts:#6b6457;--tm:#a39b8e;--saffron:#ff6b00;--sf-light:#fff3e8;--green:#16a34a;--red:#dc2626;--r:14px;--font:'Sora',sans-serif;--mono:'Space Mono',monospace}
        body{background:var(--bg);font-family:var(--font);color:var(--tx)}
        .login-page{min-height:100vh;display:flex;flex-direction:column;background:var(--bg)}
        .login-top{background:var(--tx);padding:48px 24px 56px;text-align:center;position:relative;overflow:hidden}
        .login-top::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:28px;background:var(--bg);border-radius:28px 28px 0 0}
        .brand-logo{font-family:var(--mono);font-size:28px;font-weight:700;color:#fff;margin-bottom:8px}
        .brand-logo span{color:var(--saffron)}
        .brand-tagline{font-size:13px;color:rgba(255,255,255,0.5)}
        .brand-dot{display:inline-block;width:6px;height:6px;background:var(--saffron);border-radius:50%;margin:0 6px;vertical-align:middle}
        .login-card{background:var(--surface);margin:0 16px;border-radius:var(--r);padding:28px 24px;box-shadow:0 4px 24px rgba(0,0,0,0.08);animation:slideUp .35s ease both}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .card-title{font-size:19px;font-weight:700;margin-bottom:4px}
        .card-sub{font-size:13px;color:var(--ts);margin-bottom:24px}
        .phone-highlight{font-weight:700;color:var(--saffron);font-family:var(--mono)}
        .phone-input-wrap{display:flex;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;background:#fafaf8;transition:border-color .15s}
        .phone-input-wrap:focus-within{border-color:var(--saffron);background:#fff}
        .phone-prefix{padding:14px 14px 14px 16px;font-family:var(--mono);font-size:15px;font-weight:700;color:var(--ts);border-right:1.5px solid var(--border)}
        .phone-input{flex:1;border:none;background:transparent;padding:14px 16px;font-family:var(--mono);font-size:18px;font-weight:700;color:var(--tx);letter-spacing:2px;outline:none}
        .phone-input::placeholder{color:var(--tm);font-weight:400;letter-spacing:0}
        .otp-row{display:flex;gap:8px;margin-bottom:20px;justify-content:center}
        .otp-box{width:46px;height:54px;border:1.5px solid var(--border);border-radius:10px;text-align:center;font-family:var(--mono);font-size:22px;font-weight:700;color:var(--tx);background:#fafaf8;transition:border-color .15s,background .15s;outline:none}
        .otp-box:focus{border-color:var(--saffron);background:var(--sf-light)}
        .otp-box.filled{border-color:var(--green);background:#f0fdf4;color:var(--green)}
        .btn-primary{width:100%;padding:15px;background:var(--saffron);color:#fff;border:none;border-radius:10px;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;margin-bottom:12px;transition:opacity .15s}
        .btn-primary:hover{opacity:.88}
        .btn-primary:disabled{opacity:.45;cursor:not-allowed}
        .btn-ghost{width:100%;padding:12px;background:transparent;color:var(--ts);border:none;font-family:var(--font);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
        .btn-ghost:hover{color:var(--tx)}
        .btn-ghost:disabled{color:var(--tm);cursor:not-allowed}
        .error-box{background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;gap:16px}
        .spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--saffron);border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .loading-text{font-size:14px;color:var(--ts)}
        .login-footer{margin-top:auto;padding:24px;text-align:center;font-size:11px;color:var(--tm);line-height:1.7}
        .trust-row{display:flex;gap:16px;justify-content:center;margin-top:20px;flex-wrap:wrap}
        .trust-badge{font-size:11px;color:var(--ts);display:flex;align-items:center;gap:5px}
      `}</style>

      <div className="login-page">
        <div className="login-top">
          <div className="brand-logo">Khata<span>GST</span></div>
          <div className="brand-tagline">
            Har dukaan ka CA<span className="brand-dot" />GST filing simplified
          </div>
        </div>

        <div className="login-card">
          {step === "phone" && (
            <>
              <h1 className="card-title">Welcome Back 👋</h1>
              <p className="card-sub">Enter your phone number to continue</p>
              {error && <div className="error-box">⚠️ {error}</div>}
              <div className="phone-input-wrap">
                <div className="phone-prefix">🇮🇳 +91</div>
                <input className="phone-input" type="tel" inputMode="numeric" maxLength={10}
                  placeholder="98765 43210" value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()} autoFocus />
              </div>
              <button className="btn-primary" onClick={sendOtp} disabled={phone.replace(/\D/g, "").length !== 10}>
                Send OTP →
              </button>
              <div className="trust-row">
                <div className="trust-badge">🔒 Secure OTP</div>
                <div className="trust-badge">🇮🇳 GST Compliant</div>
                <div className="trust-badge">⚡ 30 sec login</div>
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <h1 className="card-title">OTP Verify karein 🔐</h1>
              <p className="card-sub">6-digit OTP bheja gaya <span className="phone-highlight">+91 {phone}</span> pe</p>
              {error && <div className="error-box">⚠️ {error}</div>}
              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                    className={`otp-box ${digit ? "filled" : ""}`}
                    type="tel" inputMode="numeric" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)} />
                ))}
              </div>
              <button className="btn-primary" onClick={verifyOtp} disabled={otp.join("").length !== 6}>
                Verify & Login ✓
              </button>
              <button className="btn-ghost" onClick={resendTimer > 0 ? undefined : sendOtp} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "↺ OTP dobara bhejo"}
              </button>
              <button className="btn-ghost" onClick={goBack}>← Phone number badlo</button>
            </>
          )}

          {step === "loading" && (
            <div className="loading-screen">
              <div className="spinner" />
              <div className="loading-text">
                {otp.join("").length === 6 ? "Login ho raha hai..." : "OTP bheja ja raha hai..."}
              </div>
            </div>
          )}
        </div>

        <div className="login-footer">
          By logging in you agree to our Terms & Conditions <br /><br />
           Aur Privacy Policy se agree karte hain.<br /><br />
          KhataGST — Made in India 🇮🇳
        </div>
      </div>
    </>
  );
}
