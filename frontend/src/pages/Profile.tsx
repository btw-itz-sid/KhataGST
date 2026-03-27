import { useEffect, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";

interface Props {
  navigate: (route: Route) => void;
  onLogout: () => void;
}

interface BusinessInfo {
  legal_name: string;
  trade_name: string;
  gstin: string;
  address: string;
  state: string;
  phone: string;
  email: string;
}

const BASE_URL = "/api/v1";

export default function Profile({ navigate, onLogout }: Props) {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const businessCtx = getBusinessContext();
  const businessName = businessCtx?.name || "Your Business";

  useEffect(() => {
    const token = getToken();
    const businessId = businessCtx?.id;
    if (!token || !businessId) {
      setLoading(false);
      return;
    }

    async function fetchBusiness() {
      try {
        const res = await fetch(`${BASE_URL}/businesses/${businessId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.business) {
          const b = payload.business;
          setBusiness({
            legal_name: b.legal_name || "",
            trade_name: b.trade_name || "",
            gstin: b.gstin || "",
            address: b.address || "",
            state: b.state || "",
            phone: b.phone || "",
            email: b.email || "",
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, []);

  return (
    <>
      <style>{STYLES}</style>

      <nav className="prof-topbar">
        <button className="prof-back" onClick={() => navigate("dashboard")}>
          Dashboard
        </button>
        <div className="prof-brand">
          Khata<span>GST</span>
        </div>
        <div className="prof-meta">Settings</div>
      </nav>

      <div className="prof-shell">
        {/* Hero */}
        <section className="prof-hero">
          <div className="prof-hero-glow" />
          <div className="prof-hero-content">
            <div className="prof-kicker">Account & Business</div>
            <h1>Profile</h1>
            <p>
              View your business registration details and manage your
              KhataGST account settings.
            </p>
          </div>
          <div className="prof-avatar-block">
            <div className="prof-avatar">
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div className="prof-avatar-name">{businessName}</div>
            <div className="prof-avatar-sub">Business Owner</div>
          </div>
        </section>

        {loading ? (
          <section className="prof-card">
            <div className="prof-spinner" />
            <p className="prof-loading-text">Loading business details...</p>
          </section>
        ) : (
          <>
            {/* Business Details */}
            <section className="prof-card">
              <div className="prof-card-label">Business Information</div>
              <div className="prof-detail-grid">
                <DetailItem
                  label="Legal Name"
                  value={business?.legal_name || businessName}
                />
                <DetailItem
                  label="Trade Name"
                  value={business?.trade_name || "—"}
                />
                <DetailItem
                  label="GSTIN"
                  value={business?.gstin || "Not registered"}
                  mono
                />
                <DetailItem
                  label="State"
                  value={business?.state || "—"}
                />
                <DetailItem
                  label="Address"
                  value={business?.address || "—"}
                  full
                />
                <DetailItem
                  label="Phone"
                  value={business?.phone || "—"}
                />
                <DetailItem
                  label="Email"
                  value={business?.email || "—"}
                />
              </div>
            </section>

            {/* Quick Actions */}
            <section className="prof-card">
              <div className="prof-card-label">Quick Actions</div>
              <div className="prof-actions-grid">
                <button
                  className="prof-action"
                  onClick={() => navigate("export")}
                >
                  <div className="prof-action-icon">📦</div>
                  <div>
                    <strong>Export Reports</strong>
                    <span>Download GSTR-1 workbook or CSV for filing.</span>
                  </div>
                </button>
                <button
                  className="prof-action"
                  onClick={() => navigate("scan")}
                >
                  <div className="prof-action-icon">📷</div>
                  <div>
                    <strong>Scan Invoice</strong>
                    <span>Capture a new purchase invoice with AI extraction.</span>
                  </div>
                </button>
                <button
                  className="prof-action"
                  onClick={() => navigate("pricing")}
                >
                  <div className="prof-action-icon">⚡</div>
                  <div>
                    <strong>Upgrade Plan</strong>
                    <span>Unlock unlimited scans and priority support.</span>
                  </div>
                </button>
              </div>
            </section>

            {/* App Info */}
            <section className="prof-card prof-card-dark">
              <div className="prof-card-label" style={{ color: "rgba(255,255,255,0.4)" }}>
                Application
              </div>
              <div className="prof-app-row">
                <div>
                  <strong className="prof-app-name">KhataGST</strong>
                  <span className="prof-app-ver">Version 0.1.0 — Development</span>
                </div>
                <button className="prof-logout-btn" onClick={onLogout}>
                  Log out
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function DetailItem({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`prof-detail ${full ? "prof-detail-full" : ""}`}>
      <span className="prof-detail-label">{label}</span>
      <span className={`prof-detail-value ${mono ? "prof-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at top left,rgba(255,107,0,.08),transparent 22%),linear-gradient(180deg,#f8fafc 0%,#eef3f9 100%);font-family:'Manrope',sans-serif;color:#0f172a}
button,input{font-family:inherit}

.prof-topbar{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(219,227,239,.9);background:rgba(248,250,252,.88);backdrop-filter:blur(14px)}
.prof-brand{justify-self:center;font:700 18px 'IBM Plex Mono',monospace}.prof-brand span{color:#ff6b00}
.prof-back{padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.06);color:#0f172a;font-size:13px;font-weight:800;border:none;cursor:pointer;transition:transform .15s ease}
.prof-back:hover{transform:translateY(-1px)}
.prof-meta{justify-self:end;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}

.prof-shell{max-width:860px;margin:0 auto;padding:26px 16px 94px;display:flex;flex-direction:column;gap:18px}

/* Hero */
.prof-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;align-items:center;gap:28px;padding:32px;border-radius:28px;background:linear-gradient(135deg,#0f172a 0%,#172554 52%,#1e293b 100%);color:#fff;box-shadow:0 24px 56px rgba(15,23,42,.16);animation:profFade .5s ease both}
.prof-hero-glow{position:absolute;top:-40%;right:-10%;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(255,107,0,.2),transparent 70%);filter:blur(60px);pointer-events:none;animation:profGlow 8s ease-in-out infinite}
@keyframes profGlow{0%,100%{opacity:.4;transform:translate(0,0)}50%{opacity:.8;transform:translate(15px,-8px)}}
@keyframes profFade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.prof-hero-content{position:relative;z-index:2}
.prof-kicker{margin-bottom:10px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.prof-hero h1{margin:0;font-size:clamp(28px,4vw,40px);line-height:1;font-weight:800;letter-spacing:-.04em}
.prof-hero p{max-width:44ch;margin:14px 0 0;font-size:14px;line-height:1.8;color:rgba(255,255,255,.5)}

.prof-avatar-block{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:10px}
.prof-avatar{width:80px;height:80px;display:grid;place-items:center;border-radius:22px;background:linear-gradient(135deg,#ff7a1a,#ea580c);color:#fff;font:800 32px 'IBM Plex Mono',monospace;box-shadow:0 12px 28px rgba(234,88,12,.3)}
.prof-avatar-name{font-size:14px;font-weight:800;color:#fff}
.prof-avatar-sub{font-size:11px;color:rgba(255,255,255,.4)}

/* Cards */
.prof-card{padding:22px;border-radius:22px;border:1px solid rgba(219,227,239,.94);background:rgba(255,255,255,.92);box-shadow:0 14px 32px rgba(15,23,42,.04);animation:profFade .5s ease both}
.prof-card-dark{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-color:rgba(255,255,255,.06)}
.prof-card-label{margin-bottom:16px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}

/* Detail grid */
.prof-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.prof-detail{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:16px;border:1px solid rgba(219,227,239,.7);background:rgba(248,250,252,.7)}
.prof-detail-full{grid-column:1/-1}
.prof-detail-label{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a94a6}
.prof-detail-value{font-size:14px;font-weight:700;color:#0f172a}
.prof-mono{font-family:'IBM Plex Mono',monospace;letter-spacing:.04em}

/* Actions */
.prof-actions-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.prof-action{display:flex;align-items:flex-start;gap:14px;padding:18px;border-radius:18px;border:1px solid rgba(219,227,239,.7);background:rgba(248,250,252,.6);text-align:left;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
.prof-action:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.2);box-shadow:0 8px 20px rgba(255,107,0,.06)}
.prof-action-icon{font-size:22px;flex-shrink:0;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:#fff2e8}
.prof-action strong{display:block;margin-bottom:4px;font-size:14px;font-weight:800;color:#0f172a}
.prof-action span{font-size:12px;line-height:1.6;color:#5f6c80}

/* App row */
.prof-app-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.prof-app-name{display:block;font:700 18px 'IBM Plex Mono',monospace;color:#fff;margin-bottom:4px}
.prof-app-ver{font-size:12px;color:rgba(255,255,255,.4)}
.prof-logout-btn{padding:12px 20px;border-radius:14px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#ef4444;font-size:13px;font-weight:800;cursor:pointer;transition:transform .15s ease,background .15s ease}
.prof-logout-btn:hover{transform:translateY(-1px);background:rgba(239,68,68,.18)}

/* Loading */
.prof-spinner{width:36px;height:36px;border-radius:50%;border:3px solid #dbe3ef;border-top-color:#ff6b00;animation:profSpin .7s linear infinite}
.prof-loading-text{margin:10px 0 0;font-size:14px;color:#5f6c80}
@keyframes profSpin{to{transform:rotate(360deg)}}

/* Responsive */
@media (max-width:860px){.prof-hero{grid-template-columns:1fr;text-align:center}.prof-hero-content{order:2}.prof-avatar-block{order:1}.prof-actions-grid{grid-template-columns:1fr}}
@media (max-width:640px){.prof-shell{padding:18px 12px 94px}.prof-hero,.prof-card{padding:20px;border-radius:20px}.prof-detail-grid{grid-template-columns:1fr}.prof-topbar{grid-template-columns:1fr auto}.prof-brand{justify-self:start}.prof-meta{display:none}}
`;
