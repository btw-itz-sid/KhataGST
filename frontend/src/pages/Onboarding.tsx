import { useState } from "react";
import { getApiErrorMessage } from "../lib/api";
import { getToken, type StoredBusinessContext } from "../lib/session";

interface Props {
  token: string;
  onComplete: (business: StoredBusinessContext) => void;
  onRequireLogin: () => void;
}

type RegistrationType = "regular" | "composition" | "unregistered";

const STATES = [
  { label: "Andaman and Nicobar Islands", code: "35" },
  { label: "Andhra Pradesh", code: "37" },
  { label: "Arunachal Pradesh", code: "12" },
  { label: "Assam", code: "18" },
  { label: "Bihar", code: "10" },
  { label: "Chandigarh", code: "04" },
  { label: "Chhattisgarh", code: "22" },
  { label: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { label: "Delhi", code: "07" },
  { label: "Goa", code: "30" },
  { label: "Gujarat", code: "24" },
  { label: "Haryana", code: "06" },
  { label: "Himachal Pradesh", code: "02" },
  { label: "Jammu and Kashmir", code: "01" },
  { label: "Jharkhand", code: "20" },
  { label: "Karnataka", code: "29" },
  { label: "Kerala", code: "32" },
  { label: "Ladakh", code: "38" },
  { label: "Lakshadweep", code: "31" },
  { label: "Madhya Pradesh", code: "23" },
  { label: "Maharashtra", code: "27" },
  { label: "Manipur", code: "14" },
  { label: "Meghalaya", code: "17" },
  { label: "Mizoram", code: "15" },
  { label: "Nagaland", code: "13" },
  { label: "Odisha", code: "21" },
  { label: "Puducherry", code: "34" },
  { label: "Punjab", code: "03" },
  { label: "Rajasthan", code: "08" },
  { label: "Sikkim", code: "11" },
  { label: "Tamil Nadu", code: "33" },
  { label: "Telangana", code: "36" },
  { label: "Tripura", code: "16" },
  { label: "Uttar Pradesh", code: "09" },
  { label: "Uttarakhand", code: "05" },
  { label: "West Bengal", code: "19" },
] as const;

const REG_OPTIONS: {
  value: RegistrationType;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    value: "regular",
    icon: "📋",
    title: "Regular",
    description: "Normal GST registration with returns filing.",
  },
  {
    value: "composition",
    icon: "📦",
    title: "Composition",
    description: "Composition scheme business.",
  },
  {
    value: "unregistered",
    icon: "🏪",
    title: "Unregistered",
    description: "No GSTIN yet, maintain business records.",
  },
];

const STEP_META = [
  { tag: "Step 1 of 3", title: "Tell us about your business", desc: "Bas basic details do. Isse onboarding complete hoga aur dashboard ready milega." },
  { tag: "Step 2 of 3", title: "GST setup", desc: "Registration type aur state ke basis par tax calculation align hoga." },
  { tag: "Step 3 of 3", title: "You're all set!", desc: "" },
];

export default function Onboarding({
  token,
  onComplete,
  onRequireLogin,
}: Props) {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>("unregistered");
  const [gstin, setGstin] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBusiness, setCreatedBusiness] =
    useState<StoredBusinessContext | null>(null);

  const selectedState = STATES.find((s) => s.code === stateCode) ?? null;
  const requiresGstin = registrationType !== "unregistered";

  async function handleSubmit() {
    const activeToken = token || getToken();
    const trimmedBusinessName = businessName.trim();
    const trimmedOwnerName = ownerName.trim();
    const trimmedGstin = gstin.trim().toUpperCase();

    if (!activeToken) {
      setError("Session expired hai. Dobara login karo.");
      onRequireLogin();
      return;
    }

    if (!trimmedBusinessName || !trimmedOwnerName) {
      setError("Business aur owner name dono chahiye.");
      return;
    }

    if (!stateCode) {
      setError("Apna state select karo.");
      return;
    }

    if (requiresGstin && trimmedGstin.length !== 15) {
      setError("Registered business ke liye valid 15 character GSTIN chahiye.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          legal_name: trimmedBusinessName,
          trade_name: trimmedBusinessName,
          owner_name: trimmedOwnerName,
          gstin: trimmedGstin || undefined,
          state_code: stateCode,
          registration_type: registrationType,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        setError("Session expired hai. Dobara login karo.");
        onRequireLogin();
        return;
      }
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Business save nahi ho paya"));
      }

      const business = payload?.business;
      if (!business?.id) {
        throw new Error("Business create hua, but response incomplete hai.");
      }

      setCreatedBusiness({
        id: business.id,
        name: business.legal_name ?? trimmedBusinessName,
      });
      setStep(3);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Business save nahi ho paya"
      );
    } finally {
      setLoading(false);
    }
  }

  const meta = STEP_META[step - 1];

  return (
    <>
      <style>{STYLES}</style>

      <div className="ob-shell">
        {/* ── Left showcase panel ──────────────────── */}
        <section className="ob-showcase">
          <div className="ob-orb ob-orb-1" />
          <div className="ob-orb ob-orb-2" />
          <div className="ob-orb ob-orb-3" />
          <div className="ob-mesh" />

          <div className="ob-showcase-inner">
            <div className="ob-brand anim-fade" style={{ animationDelay: "0s" }}>
              Khata<span>GST</span>
            </div>

            <div className="ob-showcase-main">
              <div className="ob-kicker anim-fade" style={{ animationDelay: "0.15s" }}>
                Business Setup Wizard
              </div>
              <h1 className="anim-fade" style={{ animationDelay: "0.3s" }}>
                Get your<br />workspace<br />ready in<br />3 easy steps.
              </h1>
              <p className="ob-showcase-copy anim-fade" style={{ animationDelay: "0.5s" }}>
                Add your business details, select your GST registration
                type, and you'll have a full-featured dashboard within seconds.
              </p>
            </div>

            <div className="ob-features anim-fade" style={{ animationDelay: "0.65s" }}>
              <div className="ob-feature-card">
                <div className="ob-feature-icon">⚡</div>
                <span>Setup</span>
                <strong>Under 2 min</strong>
              </div>
              <div className="ob-feature-card">
                <div className="ob-feature-icon">🛡️</div>
                <span>Compliance</span>
                <strong>GST-ready</strong>
              </div>
              <div className="ob-feature-card">
                <div className="ob-feature-icon">🤖</div>
                <span>AI</span>
                <strong>Auto-scan bills</strong>
              </div>
            </div>

            <div className="ob-showcase-note anim-fade" style={{ animationDelay: "0.8s" }}>
              Your data is encrypted and securely stored on Neon cloud infrastructure.
            </div>
          </div>
        </section>

        {/* ── Right form panel ─────────────────────── */}
        <section className="ob-panel">
          <div className="ob-card anim-scale">
            <div className="ob-mobile-brand">
              Khata<span>GST</span>
            </div>

            {/* ── Progress bar ─────────────────────── */}
            <div className="ob-progress">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`ob-progress-seg ${i <= step ? "active" : ""} ${i === step ? "current" : ""}`} />
              ))}
            </div>

            {/* ── Step tag + title ──────────────────── */}
            <div className="ob-step-tag anim-slide" style={{ animationDelay: "0.05s" }}>
              {meta.tag}
            </div>
            <h2 className="ob-title anim-slide" style={{ animationDelay: "0.15s" }}>
              {step === 3 && createdBusiness ? "You're all set!" : meta.title}
            </h2>
            {meta.desc && (
              <p className="ob-desc anim-slide" style={{ animationDelay: "0.25s" }}>
                {meta.desc}
              </p>
            )}

            {/* ── Error ────────────────────────────── */}
            {error && <div className="ob-error shake">{error}</div>}

            {/* ── Step 1: Business info ─────────────── */}
            {step === 1 && (
              <>
                <label className="ob-label anim-slide" style={{ animationDelay: "0.3s" }}>
                  Business Name
                </label>
                <div className="ob-field-wrap anim-slide" style={{ animationDelay: "0.35s" }}>
                  <span className="ob-field-icon">🏢</span>
                  <input
                    className="ob-input"
                    placeholder="Ramesh General Store"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                <label className="ob-label anim-slide" style={{ animationDelay: "0.4s" }}>
                  Owner Name
                </label>
                <div className="ob-field-wrap anim-slide" style={{ animationDelay: "0.45s" }}>
                  <span className="ob-field-icon">👤</span>
                  <input
                    className="ob-input"
                    placeholder="Ramesh Kumar"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>

                <button
                  className="ob-cta anim-slide"
                  style={{ animationDelay: "0.55s" }}
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  disabled={!businessName.trim() || !ownerName.trim()}
                >
                  <span className="ob-cta-text">Continue</span>
                  <span className="ob-cta-arrow">→</span>
                  <span className="ob-cta-shimmer" />
                </button>
              </>
            )}

            {/* ── Step 2: GST setup ────────────────── */}
            {step === 2 && (
              <>
                <label className="ob-label anim-slide" style={{ animationDelay: "0.3s" }}>
                  Registration Type
                </label>
                <div className="ob-reg-grid anim-slide" style={{ animationDelay: "0.35s" }}>
                  {REG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`ob-reg-card ${registrationType === opt.value ? "active" : ""}`}
                      onClick={() => {
                        setRegistrationType(opt.value);
                        setError(null);
                      }}
                    >
                      <div className="ob-reg-icon">{opt.icon}</div>
                      <div className="ob-reg-title">{opt.title}</div>
                      <div className="ob-reg-desc">{opt.description}</div>
                      {registrationType === opt.value && (
                        <div className="ob-reg-check">✓</div>
                      )}
                    </button>
                  ))}
                </div>

                <label className="ob-label anim-slide" style={{ animationDelay: "0.4s" }}>
                  State
                </label>
                <div className="ob-field-wrap anim-slide" style={{ animationDelay: "0.45s" }}>
                  <span className="ob-field-icon">📍</span>
                  <select
                    className="ob-select"
                    value={stateCode}
                    onChange={(e) => {
                      setStateCode(e.target.value);
                      setError(null);
                    }}
                  >
                    <option value="">Select your state</option>
                    {STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedState && (
                  <div className="ob-state-chip anim-slide" style={{ animationDelay: "0.5s" }}>
                    <span className="ob-chip-dot" />
                    GST state code {selectedState.code}: {selectedState.label}
                  </div>
                )}

                {requiresGstin && (
                  <>
                    <label className="ob-label anim-slide" style={{ animationDelay: "0.52s" }}>
                      GSTIN
                    </label>
                    <div className="ob-field-wrap anim-slide" style={{ animationDelay: "0.55s" }}>
                      <span className="ob-field-icon">🔢</span>
                      <input
                        className="ob-input"
                        placeholder="27ABCDE1234F1Z5"
                        value={gstin}
                        onChange={(e) => {
                          setGstin(e.target.value.toUpperCase());
                          setError(null);
                        }}
                        maxLength={15}
                      />
                    </div>
                    <div className="ob-helper">
                      Regular aur composition business ke liye actual GSTIN dena zaroori hai.
                    </div>
                  </>
                )}

                {!requiresGstin && (
                  <div className="ob-helper anim-slide" style={{ animationDelay: "0.5s" }}>
                    GSTIN optional hai. App business profile create karke aapko dashboard par le jayega.
                  </div>
                )}

                <div className="ob-actions anim-slide" style={{ animationDelay: "0.6s" }}>
                  <button
                    className="ob-btn-back"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    className="ob-cta"
                    onClick={handleSubmit}
                    disabled={!stateCode || loading}
                  >
                    <span className="ob-cta-text">
                      {loading ? "Saving..." : "Complete Setup"}
                    </span>
                    <span className="ob-cta-shimmer" />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Success ──────────────────── */}
            {step === 3 && createdBusiness && (
              <div className="ob-success">
                <div className="ob-success-ring">
                  <svg viewBox="0 0 52 52" className="ob-checkmark-svg">
                    <circle className="ob-check-circle" cx="26" cy="26" r="24" fill="none" />
                    <path className="ob-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <p className="ob-success-biz">{createdBusiness.name}</p>
                <p className="ob-success-note">
                  Ka profile create ho gaya hai. Ab aap dashboard, scan aur invoices use kar sakte ho.
                </p>
                <button
                  className="ob-cta"
                  onClick={() => onComplete(createdBusiness)}
                >
                  <span className="ob-cta-text">Go To Dashboard</span>
                  <span className="ob-cta-arrow">→</span>
                  <span className="ob-cta-shimmer" />
                </button>
              </div>
            )}

            <div className="ob-footer">
              Your data is encrypted and stored securely.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   STYLES — Premium split-panel design matching Login.tsx
   ═══════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600;700&display=swap');

  * { box-sizing: border-box; }

  :root {
    --ob-bg: #0a0e1a;
    --ob-brand: #ff6b00;
    --ob-brand-light: #ff8a3d;
    --ob-brand-glow: rgba(255, 107, 0, 0.35);
    --ob-text: #f1f5f9;
    --ob-text-dark: #0f172a;
    --ob-muted: #94a3b8;
    --ob-soft: #64748b;
    --ob-card-bg: rgba(255, 255, 255, 0.97);
    --ob-card-border: rgba(226, 232, 240, 0.6);
    --ob-success: #16a34a;
    --ob-danger: #ef4444;
  }

  body {
    margin: 0;
    background: var(--ob-bg);
    color: var(--ob-text);
    font-family: 'Inter', -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Shell ─────────────────────────────────────── */
  .ob-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
  }

  /* ── Showcase (left) ───────────────────────────── */
  .ob-showcase {
    position: relative;
    overflow: hidden;
    padding: 48px;
    background:
      radial-gradient(ellipse at 20% 0%, rgba(255, 107, 0, 0.15), transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(99, 102, 241, 0.12), transparent 50%),
      linear-gradient(160deg, #0f172a 0%, #0c1222 40%, #131b30 100%);
  }

  .ob-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    pointer-events: none;
  }
  .ob-orb-1 {
    width: 420px; height: 420px;
    top: -120px; right: -80px;
    background: radial-gradient(circle, rgba(255, 107, 0, 0.4), transparent 70%);
    animation: ob-float1 12s ease-in-out infinite;
  }
  .ob-orb-2 {
    width: 320px; height: 320px;
    bottom: -80px; left: -90px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3), transparent 70%);
    animation: ob-float2 15s ease-in-out infinite;
  }
  .ob-orb-3 {
    width: 200px; height: 200px;
    top: 45%; left: 50%;
    background: radial-gradient(circle, rgba(255, 107, 0, 0.2), transparent 70%);
    animation: ob-float3 10s ease-in-out infinite;
  }

  @keyframes ob-float1 {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(-30px,40px) scale(1.1); }
    66% { transform: translate(20px,-20px) scale(0.95); }
  }
  @keyframes ob-float2 {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(40px,-30px) scale(1.05); }
    66% { transform: translate(-20px,40px) scale(0.9); }
  }
  @keyframes ob-float3 {
    0%, 100% { transform: translate(0,0) scale(1); opacity: 0.3; }
    50% { transform: translate(-40px,30px) scale(1.2); opacity: 0.5; }
  }

  .ob-mesh {
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

  .ob-showcase-inner {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: 24px;
  }

  .ob-brand, .ob-mobile-brand {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .ob-brand span, .ob-mobile-brand span {
    background: linear-gradient(135deg, #ff6b00, #ff8a3d);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .ob-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
  }

  .ob-showcase-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .ob-showcase-inner h1 {
    margin: 14px 0 0;
    font-size: clamp(38px, 5vw, 60px);
    line-height: 0.98;
    font-weight: 900;
    letter-spacing: -0.05em;
    background: linear-gradient(180deg, #fff 20%, rgba(255,255,255,0.65) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .ob-showcase-copy {
    max-width: 48ch;
    margin: 24px 0 0;
    font-size: 15px;
    line-height: 1.8;
    color: rgba(255,255,255,0.55);
  }

  .ob-features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .ob-feature-card {
    padding: 18px 16px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(12px);
    transition: transform 0.3s, border-color 0.3s, background 0.3s;
  }
  .ob-feature-card:hover {
    transform: translateY(-3px);
    border-color: rgba(255,107,0,0.25);
    background: rgba(255,255,255,0.07);
  }
  .ob-feature-icon { font-size: 20px; margin-bottom: 10px; }
  .ob-feature-card span {
    display: block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
  }
  .ob-feature-card strong {
    font-size: 15px;
    line-height: 1.3;
    color: #fff;
  }

  .ob-showcase-note {
    max-width: 42ch;
    font-size: 13px;
    line-height: 1.7;
    color: rgba(255,255,255,0.4);
  }

  /* ── Right panel ───────────────────────────────── */
  .ob-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 28px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(255,107,0,0.04), transparent 50%),
      linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    overflow-y: auto;
  }

  .ob-card {
    width: 100%;
    max-width: 460px;
    padding: 36px 32px;
    border-radius: 28px;
    border: 1px solid var(--ob-card-border);
    background: var(--ob-card-bg);
    box-shadow:
      0 1px 3px rgba(0,0,0,0.04),
      0 8px 24px rgba(0,0,0,0.06),
      0 24px 48px rgba(0,0,0,0.04);
  }

  .ob-mobile-brand {
    display: none;
    margin-bottom: 24px;
    color: var(--ob-text-dark);
  }

  /* ── Progress bar ──────────────────────────────── */
  .ob-progress {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 24px;
  }
  .ob-progress-seg {
    height: 5px;
    border-radius: 999px;
    background: #e2e8f0;
    transition: background 0.4s ease, box-shadow 0.4s ease;
  }
  .ob-progress-seg.active {
    background: linear-gradient(90deg, var(--ob-brand), var(--ob-brand-light));
  }
  .ob-progress-seg.current {
    box-shadow: 0 0 12px var(--ob-brand-glow);
  }

  /* ── Step tag ──────────────────────────────────── */
  .ob-step-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ob-brand);
    background: rgba(255,107,0,0.08);
    margin-bottom: 12px;
  }

  .ob-title {
    margin: 0 0 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--ob-text-dark);
    line-height: 1.1;
  }

  .ob-desc {
    margin: 0 0 22px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--ob-soft);
  }

  /* ── Error ─────────────────────────────────────── */
  .ob-error {
    margin-bottom: 16px;
    padding: 12px 16px;
    border-radius: 14px;
    border: 1px solid rgba(239,68,68,0.25);
    background: rgba(239,68,68,0.06);
    color: var(--ob-danger);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
  }

  /* ── Input fields ──────────────────────────────── */
  .ob-label {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ob-soft);
    letter-spacing: 0.02em;
  }

  .ob-field-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    margin-bottom: 18px;
    border-radius: 16px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .ob-field-wrap:focus-within {
    border-color: var(--ob-brand);
    box-shadow: 0 0 0 4px rgba(255,107,0,0.08), 0 0 20px rgba(255,107,0,0.06);
  }

  .ob-field-icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 32px;
    text-align: center;
  }

  .ob-input, .ob-select {
    flex: 1;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--ob-text-dark);
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    outline: none;
    padding: 10px 0;
  }
  .ob-input::placeholder {
    color: #c1c9d4;
    font-weight: 400;
  }
  .ob-select {
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  /* ── Registration type cards ───────────────────── */
  .ob-reg-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  .ob-reg-card {
    position: relative;
    padding: 16px 12px 14px;
    border-radius: 18px;
    border: 1.5px solid #e2e8f0;
    background: #fff;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .ob-reg-card:hover {
    border-color: var(--ob-brand);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255,107,0,0.1);
  }
  .ob-reg-card.active {
    border-color: var(--ob-brand);
    background: rgba(255,107,0,0.05);
    box-shadow: 0 0 0 3px rgba(255,107,0,0.1);
  }
  .ob-reg-icon { font-size: 22px; margin-bottom: 8px; }
  .ob-reg-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--ob-text-dark);
    margin-bottom: 4px;
  }
  .ob-reg-desc {
    font-size: 11px;
    line-height: 1.45;
    color: var(--ob-soft);
  }
  .ob-reg-check {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ob-brand);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: grid;
    place-items: center;
    animation: ob-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes ob-pop {
    0% { transform: scale(0); }
    100% { transform: scale(1); }
  }

  /* ── State chip ────────────────────────────────── */
  .ob-state-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    margin: -8px 0 16px;
    border-radius: 999px;
    background: rgba(255,107,0,0.06);
    border: 1px solid rgba(255,107,0,0.15);
    font-size: 12px;
    font-weight: 600;
    color: var(--ob-brand);
  }
  .ob-chip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ob-brand);
    animation: ob-pulse 1.5s ease-in-out infinite;
  }
  @keyframes ob-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .ob-helper {
    margin: -8px 0 18px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--ob-soft);
  }

  /* ── Buttons ───────────────────────────────────── */
  .ob-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .ob-cta {
    position: relative;
    overflow: hidden;
    width: 100%;
    margin-top: 10px;
    padding: 16px 20px;
    border: none;
    border-radius: 16px;
    background: linear-gradient(135deg, #ff7a1a 0%, #e8590c 50%, #ff6b00 100%);
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow:
      0 8px 20px rgba(234,88,12,0.3),
      0 2px 6px rgba(234,88,12,0.2);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .ob-cta:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 12px 28px rgba(234,88,12,0.35),
      0 4px 10px rgba(234,88,12,0.2);
  }
  .ob-cta:active:not(:disabled) { transform: translateY(0); }
  .ob-cta:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ob-cta-text { position: relative; z-index: 1; }
  .ob-cta-arrow {
    position: relative;
    z-index: 1;
    font-size: 17px;
    transition: transform 0.2s;
  }
  .ob-cta:hover:not(:disabled) .ob-cta-arrow { transform: translateX(3px); }

  .ob-cta-shimmer {
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
    pointer-events: none;
  }
  .ob-cta:hover:not(:disabled) .ob-cta-shimmer {
    animation: ob-shimmer 0.8s ease forwards;
  }
  @keyframes ob-shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .ob-btn-back {
    flex-shrink: 0;
    padding: 16px 22px;
    border: 1.5px solid #e2e8f0;
    border-radius: 16px;
    background: #fff;
    color: var(--ob-soft);
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s, transform 0.2s;
  }
  .ob-btn-back:hover {
    border-color: var(--ob-brand);
    color: var(--ob-brand);
    transform: translateY(-1px);
  }

  /* ── Success state ─────────────────────────────── */
  .ob-success {
    text-align: center;
    padding: 20px 0 10px;
  }

  .ob-success-ring {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
  }

  .ob-checkmark-svg {
    width: 80px;
    height: 80px;
  }

  .ob-check-circle {
    stroke: var(--ob-success);
    stroke-width: 2;
    stroke-dasharray: 150.79;
    stroke-dashoffset: 150.79;
    animation: ob-circle-draw 0.6s ease-out 0.2s forwards;
  }

  .ob-check-path {
    stroke: var(--ob-success);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 48;
    stroke-dashoffset: 48;
    animation: ob-check-draw 0.4s ease-out 0.7s forwards;
  }

  @keyframes ob-circle-draw {
    to { stroke-dashoffset: 0; }
  }
  @keyframes ob-check-draw {
    to { stroke-dashoffset: 0; }
  }

  .ob-success-biz {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 800;
    color: var(--ob-text-dark);
    letter-spacing: -0.02em;
  }

  .ob-success-note {
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--ob-soft);
  }

  /* ── Footer ────────────────────────────────────── */
  .ob-footer {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
    text-align: center;
    font-size: 11px;
    color: var(--ob-muted);
  }

  /* ── Animations ────────────────────────────────── */
  .anim-fade {
    opacity: 0;
    animation: ob-anim-fade 0.7s ease forwards;
  }
  @keyframes ob-anim-fade {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .anim-slide {
    opacity: 0;
    animation: ob-anim-slide 0.5s ease forwards;
  }
  @keyframes ob-anim-slide {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .anim-scale {
    animation: ob-anim-scale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes ob-anim-scale {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }

  .shake {
    animation: ob-shake 0.4s ease;
  }
  @keyframes ob-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }

  /* ── Responsive ────────────────────────────────── */
  @media (max-width: 900px) {
    .ob-shell {
      grid-template-columns: 1fr;
    }
    .ob-showcase { display: none; }
    .ob-mobile-brand { display: block; }
    .ob-panel {
      min-height: 100vh;
      padding: 24px 16px;
      align-items: flex-start;
      padding-top: 48px;
    }
    .ob-card {
      max-width: 100%;
      border-radius: 24px;
      padding: 28px 20px;
    }
    .ob-reg-grid {
      grid-template-columns: 1fr;
    }
    .ob-actions {
      flex-direction: column;
    }
  }
`;
