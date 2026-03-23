import { useState } from "react";
import { getApiErrorMessage } from "../lib/api";
import type { StoredBusinessContext } from "../lib/session";

interface Props {
  token: string;
  onComplete: (business: StoredBusinessContext) => void;
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

export default function Onboarding({ token, onComplete }: Props) {
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

  const selectedState = STATES.find((state) => state.code === stateCode) ?? null;
  const requiresGstin = registrationType !== "unregistered";

  async function handleSubmit() {
    const trimmedBusinessName = businessName.trim();
    const trimmedOwnerName = ownerName.trim();
    const trimmedGstin = gstin.trim().toUpperCase();

    if (!token) {
      setError("Session missing hai. Dobara login karo.");
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
          Authorization: `Bearer ${token}`,
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
    } catch (err: any) {
      setError(err.message || "Business save nahi ho paya");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
        body {
          margin: 0;
          background: #f5f3ef;
          color: #1a1611;
          font-family: 'Sora', sans-serif;
        }
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          background:
            radial-gradient(circle at top left, rgba(255,107,0,0.08), transparent 32%),
            linear-gradient(180deg, #f5f3ef 0%, #efeae2 100%);
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border: 1px solid #e5e1d8;
          border-radius: 20px;
          box-shadow: 0 18px 48px rgba(26, 22, 17, 0.08);
          overflow: hidden;
        }
        .card-top {
          padding: 24px 24px 12px;
          background: linear-gradient(180deg, #fff7ef 0%, rgba(255,255,255,0) 100%);
        }
        .brand {
          font-family: 'Space Mono', monospace;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .brand span { color: #ff6b00; }
        .subtle {
          font-size: 12px;
          color: #6b6457;
        }
        .content {
          padding: 8px 24px 24px;
        }
        .progress {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 14px 0 24px;
        }
        .progress div {
          height: 4px;
          border-radius: 999px;
          background: #e5e1d8;
        }
        .progress div.active {
          background: #16a34a;
        }
        .step-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          color: #ff6b00;
          background: #fff3e8;
          margin-bottom: 14px;
        }
        .title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 6px;
        }
        .desc {
          font-size: 13px;
          color: #6b6457;
          margin: 0 0 22px;
          line-height: 1.6;
        }
        .error-box {
          margin-bottom: 16px;
          border: 1px solid #fca5a5;
          border-radius: 12px;
          background: #fef2f2;
          color: #dc2626;
          padding: 12px 14px;
          font-size: 13px;
        }
        .label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #6b6457;
          margin-bottom: 6px;
          letter-spacing: 0.2px;
        }
        .input,
        .select {
          width: 100%;
          border: 1.5px solid #e5e1d8;
          border-radius: 12px;
          padding: 13px 14px;
          font: inherit;
          color: #1a1611;
          background: #fafaf8;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          margin-bottom: 16px;
          box-sizing: border-box;
        }
        .input:focus,
        .select:focus {
          border-color: #ff6b00;
          background: #fff;
        }
        .choice-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .choice {
          border: 1.5px solid #e5e1d8;
          border-radius: 14px;
          background: #fff;
          padding: 12px 10px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .choice:hover {
          border-color: #ff6b00;
          transform: translateY(-1px);
        }
        .choice.active {
          border-color: #ff6b00;
          background: #fff3e8;
        }
        .choice-title {
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .choice-desc {
          font-size: 11px;
          color: #6b6457;
          line-height: 1.45;
        }
        .helper {
          margin: -8px 0 16px;
          font-size: 12px;
          color: #6b6457;
          line-height: 1.5;
        }
        .state-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: -6px 0 16px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #f5f3ef;
          color: #6b6457;
          font-size: 11px;
          font-weight: 700;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }
        .btn-primary,
        .btn-secondary {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 14px 16px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
        }
        .btn-primary {
          background: #16a34a;
          color: #fff;
        }
        .btn-primary:hover,
        .btn-secondary:hover {
          transform: translateY(-1px);
        }
        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        .btn-secondary {
          background: #fff;
          color: #6b6457;
          border: 1.5px solid #e5e1d8;
        }
        .success {
          text-align: center;
          padding: 18px 0 10px;
        }
        .success-mark {
          width: 72px;
          height: 72px;
          margin: 0 auto 18px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #f0fdf4;
          color: #16a34a;
          font-size: 30px;
          font-weight: 700;
        }
        .success-note {
          font-size: 13px;
          line-height: 1.7;
          color: #6b6457;
          margin-bottom: 22px;
        }
        @media (max-width: 560px) {
          .card-top,
          .content {
            padding-left: 18px;
            padding-right: 18px;
          }
          .choice-grid {
            grid-template-columns: 1fr;
          }
          .actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="card-top">
            <div className="brand">
              Khata<span>GST</span>
            </div>
            <div className="subtle">Business setup wizard</div>
          </div>

          <div className="content">
            <div className="progress">
              {[1, 2, 3].map((item) => (
                <div key={item} className={item <= step ? "active" : ""} />
              ))}
            </div>

            {step === 1 && (
              <>
                <div className="step-tag">Step 1 of 3</div>
                <h2 className="title">Tell us about your business</h2>
                <p className="desc">
                  Bas basic details do. Isse onboarding complete hoga aur dashboard
                  ready milega.
                </p>

                {error && <div className="error-box">{error}</div>}

                <label className="label">Business Name</label>
                <input
                  className="input"
                  placeholder="Ramesh General Store"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                />

                <label className="label">Owner Name</label>
                <input
                  className="input"
                  placeholder="Ramesh Kumar"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                />

                <div className="actions">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    disabled={!businessName.trim() || !ownerName.trim()}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="step-tag">Step 2 of 3</div>
                <h2 className="title">GST setup</h2>
                <p className="desc">
                  Registration type aur state ke basis par tax calculation align
                  hoga.
                </p>

                {error && <div className="error-box">{error}</div>}

                <label className="label">Registration Type</label>
                <div className="choice-grid">
                  {[
                    {
                      value: "regular" as const,
                      title: "Regular",
                      description: "Normal GST registration with returns filing.",
                    },
                    {
                      value: "composition" as const,
                      title: "Composition",
                      description: "Composition scheme business.",
                    },
                    {
                      value: "unregistered" as const,
                      title: "Unregistered",
                      description: "No GSTIN yet, but business records maintain karne hain.",
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      className={`choice ${
                        registrationType === item.value ? "active" : ""
                      }`}
                      onClick={() => {
                        setRegistrationType(item.value);
                        setError(null);
                      }}
                    >
                      <div className="choice-title">{item.title}</div>
                      <div className="choice-desc">{item.description}</div>
                    </button>
                  ))}
                </div>

                <label className="label">State</label>
                <select
                  className="select"
                  value={stateCode}
                  onChange={(event) => {
                    setStateCode(event.target.value);
                    setError(null);
                  }}
                >
                  <option value="">Select your state</option>
                  {STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.label}
                    </option>
                  ))}
                </select>

                {selectedState && (
                  <div className="state-chip">
                    GST state code {selectedState.code}: {selectedState.label}
                  </div>
                )}

                {requiresGstin && (
                  <>
                    <label className="label">GSTIN</label>
                    <input
                      className="input"
                      placeholder="27ABCDE1234F1Z5"
                      value={gstin}
                      onChange={(event) => {
                        setGstin(event.target.value.toUpperCase());
                        setError(null);
                      }}
                      maxLength={15}
                    />
                    <div className="helper">
                      Regular aur composition business ke liye actual GSTIN dena
                      zaroori hai.
                    </div>
                  </>
                )}

                {!requiresGstin && (
                  <div className="helper">
                    GSTIN optional hai. App business profile create karke aapko
                    dashboard par le jayega.
                  </div>
                )}

                <div className="actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setError(null);
                      setStep(1);
                    }}
                  >
                    Go Back
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={!stateCode || loading}
                  >
                    {loading ? "Saving..." : "Complete Setup"}
                  </button>
                </div>
              </>
            )}

            {step === 3 && createdBusiness && (
              <div className="success">
                <div className="success-mark">OK</div>
                <h2 className="title">Business ready</h2>
                <p className="success-note">
                  {createdBusiness.name} ka profile create ho gaya hai. Ab aap
                  dashboard, scan aur invoices use kar sakte ho.
                </p>
                <button
                  className="btn-primary"
                  onClick={() => onComplete(createdBusiness)}
                >
                  Go To Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
