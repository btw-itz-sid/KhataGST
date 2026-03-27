import { useEffect, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";
type TabId = "business" | "preferences" | "team";

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
  const [tab, setTab] = useState<TabId>("business");
  const [notifs, setNotifs] = useState({ email: true, sms: false, reports: true });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    legal_name: "",
    trade_name: "",
    address: "",
    state: "",
  });
  const [isSaving, setIsSaving] = useState(false);

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
            state: b.state_code || "",
            phone: b.phone || "",
            email: b.email || "",
          });
          setEditForm({
            legal_name: b.legal_name || "",
            trade_name: b.trade_name || "",
            address: b.address || "",
            state: b.state_code || "",
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [businessCtx?.id]);

  async function handleSaveProfile() {
    const token = getToken();
    if (!token || !businessCtx?.id) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/businesses/${businessCtx.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legal_name: editForm.legal_name,
          trade_name: editForm.trade_name,
          address: editForm.address,
          state_code: editForm.state,
        }),
      });
      const data = await res.json();
      if (res.ok && data.business) {
        setBusiness((prev) => prev ? { ...prev, ...data.business, state: data.business.state_code } : null);
        setIsEditing(false);
      } else {
        alert(data.error || "Failed to update profile");
      }
    } catch {
      alert("Network error updating profile");
    } finally {
      setIsSaving(false);
    }
  }

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
        <section className="prof-hero">
          <div className="prof-hero-glow" />
          <div className="prof-hero-content">
            <div className="prof-kicker">Account Workplace</div>
            <h1>Settings & Preferences</h1>
            <p>
              Manage your business compliance details, notification preferences, 
              and team member access controls.
            </p>
          </div>
          <div className="prof-avatar-block">
            <div className="prof-avatar">
              {businessName.charAt(0).toUpperCase()}
            </div>
            <div className="prof-avatar-name">{businessName}</div>
            <span className="prof-badge">Owner</span>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="prof-tabs">
          {(["business", "preferences", "team"] as TabId[]).map((t) => (
            <button
              key={t}
              className={`prof-tab ${tab === t ? "prof-tab-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "business" && "Business Profile"}
              {t === "preferences" && "Preferences"}
              {t === "team" && "Team Access"}
            </button>
          ))}
        </div>

        {loading ? (
          <section className="prof-card">
            <div className="prof-spinner" />
            <p className="prof-loading-text">Loading settings...</p>
          </section>
        ) : (
          <div className="prof-tab-content">
            {tab === "business" && (
              <div className="anim-fade-in">
                <section className="prof-card">
                  <div className="prof-card-head">
                    <div>
                      <h2 className="prof-card-title">Registration Details</h2>
                      <p className="prof-card-sub">GST filing and billing information.</p>
                    </div>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="prof-btn-outline" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
                        <button className="prof-btn-primary" onClick={handleSaveProfile} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : (
                      <button className="prof-btn-outline" onClick={() => setIsEditing(true)}>Edit Profile</button>
                    )}
                  </div>

                  <div className="prof-detail-grid">
                    {isEditing ? (
                      <>
                        <label className="prof-field">
                          <span>Legal Name</span>
                          <input className="prof-select" style={{ padding: "10px" }} value={editForm.legal_name} onChange={e => setEditForm({...editForm, legal_name: e.target.value})} />
                        </label>
                        <label className="prof-field">
                          <span>Trade Name</span>
                          <input className="prof-select" style={{ padding: "10px" }} value={editForm.trade_name} onChange={e => setEditForm({...editForm, trade_name: e.target.value})} />
                        </label>
                        <DetailItem label="GSTIN (Locked)" value={business?.gstin || "Not registered"} mono />
                        <label className="prof-field">
                          <span>State Code (e.g. 24)</span>
                          <input className="prof-select" style={{ padding: "10px" }} value={editForm.state} onChange={e => setEditForm({...editForm, state: e.target.value})} maxLength={2} />
                        </label>
                        <label className="prof-field" style={{ gridColumn: "1 / -1" }}>
                          <span>Address</span>
                          <input className="prof-select" style={{ padding: "10px" }} value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                        </label>
                      </>
                    ) : (
                      <>
                        <DetailItem label="Legal Name" value={business?.legal_name || businessName} />
                        <DetailItem label="Trade Name" value={business?.trade_name || "—"} />
                        <DetailItem label="GSTIN" value={business?.gstin || "Not registered"} mono />
                        <DetailItem label="State Code" value={business?.state || "—"} />
                        <DetailItem label="Address" value={business?.address || "—"} full />
                      </>
                    )}
                  </div>
                </section>

                <section className="prof-card" style={{ marginTop: 18 }}>
                  <h2 className="prof-card-title" style={{ marginBottom: 14 }}>Quick Actions</h2>
                  <div className="prof-actions-grid">
                    <button className="prof-action" onClick={() => navigate("export")}>
                      <div className="prof-action-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>📦</div>
                      <div>
                        <strong>Export Data</strong>
                        <span>Download GSTR workbooks.</span>
                      </div>
                    </button>
                    <button className="prof-action" onClick={() => navigate("pricing")}>
                      <div className="prof-action-icon" style={{ background: "#fef3c7", color: "#d97706" }}>⚡</div>
                      <div>
                        <strong>Billing Plan</strong>
                        <span>Manage subscription.</span>
                      </div>
                    </button>
                  </div>
                </section>
              </div>
            )}

            {tab === "preferences" && (
              <div className="anim-fade-in">
                <section className="prof-card">
                  <h2 className="prof-card-title">Notification Settings</h2>
                  <p className="prof-card-sub" style={{ marginBottom: 20 }}>
                    Control how and when KhataGST alerts you about compliance events.
                  </p>

                  <div className="prof-toggle-list">
                    <ToggleItem 
                      label="Email Alerts" 
                      desc="Receive monthly filing reminders and summary reports."
                      checked={notifs.email} 
                      onChange={() => setNotifs({...notifs, email: !notifs.email})} 
                    />
                    <ToggleItem 
                      label="SMS Notifications" 
                      desc="Get urgent alerts for OTPs and immediate filing deadlines."
                      checked={notifs.sms} 
                      onChange={() => setNotifs({...notifs, sms: !notifs.sms})} 
                    />
                    <ToggleItem 
                      label="Automated Reports" 
                      desc="Receive automated CSV exports of your register on the 1st of every month."
                      checked={notifs.reports} 
                      onChange={() => setNotifs({...notifs, reports: !notifs.reports})} 
                    />
                  </div>
                </section>

                <section className="prof-card" style={{ marginTop: 18 }}>
                  <h2 className="prof-card-title">Display & Region</h2>
                  <div className="prof-pref-grid">
                    <label className="prof-field">
                      <span>Filing Frequency</span>
                      <select className="prof-select" defaultValue="monthly">
                        <option value="monthly">Monthly (Regular)</option>
                        <option value="qrmp">Quarterly (QRMP)</option>
                      </select>
                    </label>
                    <label className="prof-field">
                      <span>Timezone</span>
                      <select className="prof-select" defaultValue="ist">
                        <option value="ist">India Standard Time (IST)</option>
                        <option value="utc">Coordinated Universal Time (UTC)</option>
                      </select>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {tab === "team" && (
              <div className="anim-fade-in">
                <section className="prof-card">
                  <div className="prof-card-head">
                    <div>
                      <h2 className="prof-card-title">Team Members</h2>
                      <p className="prof-card-sub">Manage who has access to this business profile.</p>
                    </div>
                    <button className="prof-btn-primary">+ Invite Member</button>
                  </div>

                  <div className="prof-team-list">
                    <div className="prof-team-member">
                      <div className="prof-t-avatar" style={{ background: "#fefce8", color: "#a16207" }}>A</div>
                      <div className="prof-t-info">
                        <strong>Arjun Patel (You)</strong>
                        <span>arjun@example.com</span>
                      </div>
                      <span className="prof-badge prof-b-admin">Owner</span>
                    </div>
                    <div className="prof-team-member">
                      <div className="prof-t-avatar" style={{ background: "#f0fdf4", color: "#166534" }}>C</div>
                      <div className="prof-t-info">
                        <strong>Chirag (CA)</strong>
                        <span>ca.chirag@example.com</span>
                      </div>
                      <span className="prof-badge">Accountant</span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        <section className="prof-card prof-card-dark">
          <div className="prof-app-row">
            <div>
              <strong className="prof-app-name">KhataGST Engine</strong>
              <span className="prof-app-ver">Ready for Deployment — SaaS Mode</span>
            </div>
            <button className="prof-logout-btn" onClick={onLogout}>
              Secure Log out
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function DetailItem({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean; }) {
  return (
    <div className={`prof-detail ${full ? "prof-detail-full" : ""}`}>
      <span className="prof-detail-label">{label}</span>
      <span className={`prof-detail-value ${mono ? "prof-mono" : ""}`}>{value}</span>
    </div>
  );
}

function ToggleItem({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void; }) {
  return (
    <div className="prof-toggle-row">
      <div className="prof-toggle-text">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <label className="prof-switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="prof-slider"></span>
      </label>
    </div>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at top right,rgba(255,107,0,.05),transparent 30%),linear-gradient(180deg,#f8fafc 0%,#eef3f9 100%);font-family:'Manrope',sans-serif;color:#0f172a}
button,input,select{font-family:inherit}

.prof-topbar{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(219,227,239,.9);background:rgba(248,250,252,.88);backdrop-filter:blur(14px)}
.prof-brand{justify-self:center;font:700 18px 'IBM Plex Mono',monospace}.prof-brand span{color:#ff6b00}
.prof-back{padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.06);color:#0f172a;font-size:13px;font-weight:800;border:none;cursor:pointer;transition:transform .15s}
.prof-back:hover{transform:translateY(-1px);background:rgba(15,23,42,.09)}
.prof-meta{justify-self:end;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}

.prof-shell{max-width:860px;margin:0 auto;padding:26px 16px 94px;display:flex;flex-direction:column;gap:20px}

/* Hero */
.prof-hero{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;align-items:center;gap:28px;padding:36px;border-radius:28px;background:linear-gradient(135deg,#0f172a 0%,#172554 52%,#1e293b 100%);color:#fff;box-shadow:0 24px 56px rgba(15,23,42,.16)}
.prof-hero-glow{position:absolute;top:-40%;right:0;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,107,0,.25),transparent 70%);filter:blur(50px);pointer-events:none;animation:profGlow 8s ease-in-out infinite}
@keyframes profGlow{0%,100%{opacity:.4;transform:translateY(0)}50%{opacity:.8;transform:translateY(-15px)}}

.prof-hero-content{position:relative;z-index:2}
.prof-kicker{margin-bottom:12px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4)}
.prof-hero h1{margin:0;font-size:clamp(26px,4vw,36px);line-height:1.1;font-weight:800;letter-spacing:-.03em}
.prof-hero p{max-width:48ch;margin:14px 0 0;font-size:14px;line-height:1.8;color:rgba(255,255,255,.55)}

.prof-avatar-block{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:10px}
.prof-avatar{width:86px;height:86px;display:grid;place-items:center;border-radius:24px;background:linear-gradient(135deg,#ff7a1a,#ea580c);color:#fff;font:800 36px 'IBM Plex Mono',monospace;box-shadow:0 12px 28px rgba(234,88,12,.3)}
.prof-avatar-name{font-size:15px;font-weight:800;color:#fff}
.prof-badge{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);padding:4px 10px;border-radius:10px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}

/* Tabs */
.prof-tabs{display:flex;gap:4px;padding:6px;border-radius:18px;background:rgba(255,255,255,.6);border:1px solid rgba(219,227,239,.6);backdrop-filter:blur(10px)}
.prof-tab{flex:1;padding:12px;border-radius:14px;border:none;background:transparent;color:#64748b;font-size:13px;font-weight:800;cursor:pointer;transition:all .2s ease}
.prof-tab:hover{color:#0f172a}
.prof-tab-active{background:#fff;color:#0f172a;box-shadow:0 4px 12px rgba(15,23,42,.05)}

/* Cards */
.anim-fade-in{animation:fadeIn .4s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.prof-card{padding:26px;border-radius:24px;border:1px solid rgba(219,227,239,.9);background:rgba(255,255,255,.94);box-shadow:0 14px 32px rgba(15,23,42,.03)}
.prof-card-dark{background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;border-color:rgba(255,255,255,.06)}
.prof-card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.prof-card-title{margin:0;font-size:18px;font-weight:800;letter-spacing:-.02em}
.prof-card-sub{margin:6px 0 0;font-size:13px;color:#64748b}

.prof-btn-outline{padding:10px 16px;border-radius:12px;border:1px solid #cbd5e1;background:transparent;font-size:13px;font-weight:800;color:#334155;cursor:pointer;transition:all .15s}
.prof-btn-outline:hover{background:#f8fafc;border-color:#94a3b8}
.prof-btn-primary{padding:10px 16px;border-radius:12px;border:none;background:#ff6b00;font-size:13px;font-weight:800;color:#fff;cursor:pointer;box-shadow:0 6px 16px rgba(255,107,0,.25);transition:all .15s}
.prof-btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(255,107,0,.3)}

/* Grid & Items */
.prof-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.prof-detail{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:16px;border:1px solid rgba(219,227,239,.6);background:#f8fafc}
.prof-detail-full{grid-column:1/-1}
.prof-detail-label{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a94a6}
.prof-detail-value{font-size:14px;font-weight:700;color:#0f172a}
.prof-mono{font-family:'IBM Plex Mono',monospace;letter-spacing:.04em}

/* Toggles & Preferences */
.prof-toggle-list{display:flex;flex-direction:column;gap:12px}
.prof-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px;border-radius:16px;border:1px solid rgba(219,227,239,.6);background:#f8fafc}
.prof-toggle-text strong{display:block;font-size:14px;font-weight:800;margin-bottom:4px}
.prof-toggle-text span{font-size:13px;color:#64748b;line-height:1.5}
.prof-switch{position:relative;display:inline-block;width:48px;height:26px;flex-shrink:0}
.prof-switch input{opacity:0;width:0;height:0}
.prof-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#cbd5e1;border-radius:34px;transition:.4s}
.prof-slider:before{position:absolute;content:"";height:20px;width:20px;left:3px;bottom:3px;background-color:white;border-radius:50%;transition:.3s;box-shadow:0 2px 6px rgba(0,0,0,.15)}
input:checked + .prof-slider{background-color:#10b981}
input:checked + .prof-slider:before{transform:translateX(22px)}

.prof-pref-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.prof-field{display:flex;flex-direction:column;gap:8px}
.prof-field span{font-size:12px;font-weight:800;color:#64748b}
.prof-select{width:100%;padding:14px;border-radius:14px;border:1.5px solid #dbe3ef;font-size:14px;font-weight:600;color:#0f172a;outline:none;background:#fff}
.prof-select:focus{border-color:#ff6b00;box-shadow:0 0 0 4px rgba(255,107,0,.08)}

/* Team */
.prof-team-list{display:flex;flex-direction:column;gap:12px}
.prof-team-member{display:flex;align-items:center;gap:16px;padding:16px;border-radius:16px;border:1px solid rgba(219,227,239,.6);background:#f8fafc}
.prof-t-avatar{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:18px}
.prof-t-info{flex:1}
.prof-t-info strong{display:block;font-size:14px;font-weight:800;margin-bottom:2px}
.prof-t-info span{font-size:12px;color:#64748b}
.prof-team-member .prof-badge{background:#e2e8f0;color:#475569;border:none}
.prof-team-member .prof-b-admin{background:#fefce8;color:#ca8a04}

/* Actions */
.prof-actions-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.prof-action{display:flex;align-items:center;gap:16px;padding:20px;border-radius:20px;border:1px solid rgba(219,227,239,.6);background:#f8fafc;text-align:left;cursor:pointer;transition:all .2s ease}
.prof-action:hover{transform:translateY(-2px);border-color:#cbd5e1;box-shadow:0 10px 24px rgba(15,23,42,.04)}
.prof-action-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:24px;flex-shrink:0}
.prof-action strong{display:block;font-size:15px;font-weight:800;margin-bottom:4px}
.prof-action span{font-size:13px;color:#64748b}

/* App Row */
.prof-app-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.prof-app-name{display:block;font:800 18px 'IBM Plex Mono',monospace;color:#fff;margin-bottom:4px}
.prof-app-ver{font-size:12px;color:rgba(255,255,255,.5);font-weight:600}
.prof-logout-btn{padding:12px 20px;border-radius:14px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);color:#ef4444;font-size:13px;font-weight:800;cursor:pointer;transition:all .15s}
.prof-logout-btn:hover{background:rgba(239,68,68,.2)}

@media (max-width:640px){.prof-hero{grid-template-columns:1fr;text-align:center;padding:28px}.prof-hero-content{order:2}.prof-avatar-block{order:1}.prof-detail-grid,.prof-pref-grid,.prof-actions-grid{grid-template-columns:1fr}.prof-toggle-row{flex-direction:column;align-items:flex-start}.prof-app-row{flex-direction:column;text-align:center}.prof-tab{padding:10px 6px;font-size:12px}}
`;
