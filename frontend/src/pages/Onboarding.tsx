import "./Onboarding.css";
import { useState } from "react";
import { getApiErrorMessage, BASE_URL } from "../lib/api";
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
      const response = await fetch(`${BASE_URL}/businesses`, {
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div className="ob-mobile-brand" style={{ marginBottom: 0 }}>
                Khata<span>GST</span>
              </div>
              <button
                type="button"
                onClick={onRequireLogin}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ob-soft)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  transition: "color 0.2s, background 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--ob-danger)";
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--ob-soft)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Sign out
              </button>
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
            {error && <div role="alert" className="ob-error shake">{error}</div>}

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
                    aria-label="Business name" placeholder="Ramesh General Store"
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
                    aria-label="Owner name" placeholder="Ramesh Kumar"
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
                    aria-label="Business state" className="ob-select"
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
