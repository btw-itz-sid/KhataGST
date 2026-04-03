// ─────────────────────────────────────────────────────────────────────────────
// Profile.tsx — Business Settings & Account Page
// User apna business info dekh sakta hai, edit kar sakta hai
// Team access, notification preferences, aur logout bhi yahan hai
// Sab real API se — koi hardcoded user nahi
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

// Route type
type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";

// Tab options — 3 sections
type TabId = "business" | "preferences" | "danger";

// Business data ka structure
interface BusinessInfo {
  legal_name: string;
  trade_name: string;
  gstin: string;
  address: string;
  state_code: string;
  phone: string;
  email: string;
}

// Notification preferences
interface NotifPrefs {
  emailAlerts: boolean;
  smsAlerts: boolean;
  monthlyReports: boolean;
}

// Props
interface Props {
  navigate: (route: Route) => void;
  onLogout: () => void;
}

// Backend URL
const BASE_URL = "/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Main Profile Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Profile({ navigate, onLogout }: Props) {
  // Loading aur data state
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("business");

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    legal_name: "",
    trade_name: "",
    address: "",
    state_code: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Notification preferences (local state — future mein API se save hoga)
  const [notifs, setNotifs] = useState<NotifPrefs>({
    emailAlerts: true,
    smsAlerts: false,
    monthlyReports: true,
  });

  // Session se business context
  const bCtx = getBusinessContext();
  const displayName = bCtx?.name || "Your Business";

  // ── Business info fetch karo ─────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const businessId = bCtx?.id;

    // Session nahi hai toh show karo empty state
    if (!token || !businessId) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/businesses/${businessId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (res.ok && payload?.business) {
          const b = payload.business;
          const info: BusinessInfo = {
            legal_name: b.legal_name || "",
            trade_name: b.trade_name || "",
            gstin: b.gstin || "",
            address: b.address || "",
            state_code: b.state_code || "",
            phone: b.phone || "",
            email: b.email || "",
          };
          setBusiness(info);
          // Edit form mein prefill karo
          setEditForm({
            legal_name: info.legal_name,
            trade_name: info.trade_name,
            address: info.address,
            state_code: info.state_code,
          });
        }
      })
      .catch(() => {
        // Silently fail — business info optional hai
      })
      .finally(() => setLoading(false));
  }, [bCtx?.id]);

  // ── Profile save karo ────────────────────────────────────────────────
  async function handleSave() {
    const token = getToken();
    if (!token || !bCtx?.id) return;

    setIsSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch(`${BASE_URL}/businesses/${bCtx.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          legal_name: editForm.legal_name.trim(),
          trade_name: editForm.trade_name.trim(),
          address: editForm.address.trim(),
          state_code: editForm.state_code.trim(),
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.business) {
        // Update local state with new data
        setBusiness((prev) =>
          prev ? { ...prev, ...data.business } : null
        );
        setIsEditing(false);
        setSaveMsg({ ok: true, text: "Business profile updated." });
      } else {
        setSaveMsg({ ok: false, text: data?.error || "Update fail hua." });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Network error. Dobara try karo." });
    } finally {
      setIsSaving(false);
    }
  }

  // ── Avatar initials — business naam se pehla letter ─────────────────
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Top Navigation ─────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">Settings</div>
        <div style={{ width: 90 }} />
      </header>

      <main className="page">

        {/* ── Profile Hero Strip ──────────────────────────────────────── */}
        <div className="profile-hero">
          <div className="avatar">{avatarChar}</div>
          <div className="profile-info">
            <h1 className="profile-name">{displayName}</h1>
            {business?.gstin && (
              <span className="gstin-pill">{business.gstin}</span>
            )}
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────── */}
        <div className="tab-bar">
          {(["business", "preferences", "danger"] as TabId[]).map((t) => (
            <button
              key={t}
              className={`tab-btn ${activeTab === t ? "tab-active" : ""}`}
              onClick={() => setActiveTab(t)}
            >
              {t === "business" && "Business Details"}
              {t === "preferences" && "Preferences"}
              {t === "danger" && "Account"}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────── */}

        {/* Loading state jab data fetch ho raha ho */}
        {loading ? (
          <div className="center-state">
            <div className="spinner" />
            <span>Loading business details…</span>
          </div>
        ) : (
          <>
            {/* ── BUSINESS DETAILS TAB ─────────────────────────────── */}
            {activeTab === "business" && (
              <div className="tab-panel">

                {/* Save message */}
                {saveMsg && (
                  <div className={`msg-banner ${saveMsg.ok ? "msg-ok" : "msg-err"}`}>
                    {saveMsg.text}
                  </div>
                )}

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Registration Details</h2>
                      <p className="card-sub">GST filing aur billing ki info.</p>
                    </div>

                    {/* Edit / Save / Cancel buttons */}
                    {isEditing ? (
                      <div className="btn-group">
                        <button
                          className="btn-ghost"
                          onClick={() => { setIsEditing(false); setSaveMsg(null); }}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-primary"
                          onClick={handleSave}
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-ghost"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Detail grid — view ya edit mode */}
                  <div className="detail-grid">
                    {isEditing ? (
                      <>
                        <Field
                          label="Legal Name"
                          value={editForm.legal_name}
                          onChange={(v) => setEditForm({ ...editForm, legal_name: v })}
                        />
                        <Field
                          label="Trade Name"
                          value={editForm.trade_name}
                          onChange={(v) => setEditForm({ ...editForm, trade_name: v })}
                        />
                        {/* GSTIN lock hai — edit nahi ho sakta */}
                        <DetailItem label="GSTIN (Locked)" value={business?.gstin || "Not registered"} mono />
                        <Field
                          label="State Code"
                          value={editForm.state_code}
                          onChange={(v) => setEditForm({ ...editForm, state_code: v })}
                          placeholder="e.g. 24"
                          maxLength={2}
                        />
                        <Field
                          label="Address"
                          value={editForm.address}
                          onChange={(v) => setEditForm({ ...editForm, address: v })}
                          full
                        />
                      </>
                    ) : (
                      <>
                        {/* View mode — real data ya placeholder */}
                        <DetailItem label="Legal Name" value={business?.legal_name || displayName} />
                        <DetailItem label="Trade Name" value={business?.trade_name || "—"} />
                        <DetailItem label="GSTIN" value={business?.gstin || "Not registered"} mono />
                        <DetailItem label="State Code" value={business?.state_code || "—"} />
                        <DetailItem label="Phone" value={business?.phone || "—"} />
                        <DetailItem label="Email" value={business?.email || "—"} />
                        <DetailItem label="Address" value={business?.address || "—"} full />
                      </>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="card" style={{ marginTop: 14 }}>
                  <h2 className="card-title" style={{ marginBottom: 14 }}>Quick Actions</h2>
                  <div className="actions-row">
                    <button className="action-tile" onClick={() => navigate("export")}>
                      <div className="tile-icon tile-blue">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
                          <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
                        </svg>
                      </div>
                      <strong>Export GSTR</strong>
                      <span>Excel / CSV download</span>
                    </button>
                    <button className="action-tile" onClick={() => navigate("invoices")}>
                      <div className="tile-icon tile-green">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
                          <path d="M9 12h6"/><path d="M9 16h6"/>
                        </svg>
                      </div>
                      <strong>Invoice Register</strong>
                      <span>View all invoices</span>
                    </button>
                    <button className="action-tile" onClick={() => navigate("scan")}>
                      <div className="tile-icon tile-orange">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7"/><path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7"/>
                          <path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17"/>
                        </svg>
                      </div>
                      <strong>Scan Invoice</strong>
                      <span>AI bill capture</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PREFERENCES TAB ──────────────────────────────────── */}
            {activeTab === "preferences" && (
              <div className="tab-panel">
                <div className="card">
                  <h2 className="card-title">Notification Settings</h2>
                  <p className="card-sub" style={{ marginBottom: 20 }}>
                    KhataGST kab aur kaise alert bheje — yahan control karo.
                  </p>

                  <div className="toggle-list">
                    <ToggleRow
                      label="Email Alerts"
                      desc="Monthly filing reminders aur summary reports."
                      checked={notifs.emailAlerts}
                      onChange={() => setNotifs({ ...notifs, emailAlerts: !notifs.emailAlerts })}
                    />
                    <ToggleRow
                      label="SMS Notifications"
                      desc="OTP aur urgent filing deadline alerts."
                      checked={notifs.smsAlerts}
                      onChange={() => setNotifs({ ...notifs, smsAlerts: !notifs.smsAlerts })}
                    />
                    <ToggleRow
                      label="Monthly Reports"
                      desc="Har mahine ke 1 tarik ko automated CSV export milega."
                      checked={notifs.monthlyReports}
                      onChange={() => setNotifs({ ...notifs, monthlyReports: !notifs.monthlyReports })}
                    />
                  </div>
                </div>

                <div className="card" style={{ marginTop: 14 }}>
                  <h2 className="card-title">Filing Settings</h2>
                  <div className="pref-grid">
                    <label className="pref-field">
                      <span>Filing Frequency</span>
                      <select className="pref-select" defaultValue="monthly">
                        <option value="monthly">Monthly (Regular)</option>
                        <option value="qrmp">Quarterly (QRMP)</option>
                      </select>
                    </label>
                    <label className="pref-field">
                      <span>Default Currency</span>
                      <select className="pref-select" defaultValue="inr">
                        <option value="inr">INR (Indian Rupee)</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ── ACCOUNT / DANGER TAB ─────────────────────────────── */}
            {activeTab === "danger" && (
              <div className="tab-panel">
                <div className="card">
                  <h2 className="card-title">Account Actions</h2>
                  <p className="card-sub" style={{ marginBottom: 20 }}>
                    Ye actions permanent hain — soch samajh ke karo.
                  </p>

                  <div className="danger-list">
                    <div className="danger-row">
                      <div>
                        <strong>Sign Out</strong>
                        <p>Is device se logout ho jao. Data safe rahega.</p>
                      </div>
                      <button className="btn-danger" onClick={onLogout}>
                        Sign Out
                      </button>
                    </div>

                    <div className="danger-row">
                      <div>
                        <strong>Export All Data</strong>
                        <p>Apna poora invoice data download karo before kuch bhi delete karo.</p>
                      </div>
                      <button className="btn-ghost" onClick={() => navigate("export")}>
                        Export Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </>
  );
}

// ── Helper component: Read-only detail row ─────────────────────────────────
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
    <div className={`detail-item ${full ? "detail-full" : ""}`}>
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "mono-val" : ""}`}>{value}</span>
    </div>
  );
}

// ── Helper component: Editable field ──────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  full?: boolean;
}) {
  return (
    <label className={`pref-field ${full ? "detail-full" : ""}`}>
      <span>{label}</span>
      <input
        className="pref-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </label>
  );
}

// ── Helper component: Toggle switch row ────────────────────────────────────
function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider" />
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Same design system as other pages
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{background:#f9fafb;font-family:'Inter',sans-serif;color:#111827;-webkit-font-smoothing:antialiased}
button,input,select{font-family:inherit;outline:none}

/* ── Top Nav ──────────────────────────────────────────────────────────────── */
.topbar{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;gap:16px;
  padding:0 20px;height:56px;
  background:#fff;border-bottom:1px solid #e5e7eb;
}
.topbar-brand{
  font-family:'JetBrains Mono',monospace;
  font-size:15px;font-weight:700;color:#111827;flex:1;text-align:center;
}
.back-btn{
  padding:7px 12px;border-radius:7px;
  background:#f9fafb;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;
  cursor:pointer;transition:all .15s;
}
.back-btn:hover{background:#f3f4f6}

/* ── Page ────────────────────────────────────────────────────────────────── */
.page{
  max-width:680px;margin:0 auto;
  padding:24px 16px 100px;
  display:flex;flex-direction:column;gap:14px;
}

/* ── Profile Hero ─────────────────────────────────────────────────────────── */
.profile-hero{
  display:flex;align-items:center;gap:14px;
  padding:20px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
}
.avatar{
  width:48px;height:48px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,#f97316,#ea580c);
  color:#fff;font-size:20px;font-weight:800;
  display:flex;align-items:center;justify-content:center;
  font-family:'JetBrains Mono',monospace;
}
.profile-info{flex:1;min-width:0}
.profile-name{
  font-size:16px;font-weight:700;color:#111827;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.gstin-pill{
  display:inline-flex;align-items:center;margin-top:4px;
  padding:3px 9px;border-radius:5px;
  background:#f3f4f6;border:1px solid #e5e7eb;
  font-family:'JetBrains Mono',monospace;font-size:11px;
  font-weight:700;color:#6b7280;letter-spacing:.04em;
}
.logout-btn{
  display:flex;align-items:center;gap:6px;
  padding:8px 14px;border-radius:7px;
  background:#fee2e2;border:1px solid #fca5a5;
  color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;
  transition:all .15s;flex-shrink:0;
}
.logout-btn:hover{background:#fecaca}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.tab-bar{
  display:flex;gap:6px;padding:4px;
  border-radius:9px;background:#f3f4f6;
}
.tab-btn{
  flex:1;padding:9px 12px;border-radius:7px;
  background:transparent;border:none;cursor:pointer;
  font-size:13px;font-weight:600;color:#6b7280;
  transition:all .15s;
}
.tab-btn:hover{color:#374151}
.tab-active{background:#fff;color:#111827;box-shadow:0 1px 3px rgba(0,0,0,.08)}

/* ── Tab Panel ─────────────────────────────────────────────────────────────── */
.tab-panel{animation:fadeIn .3s ease both}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── Card ──────────────────────────────────────────────────────────────────── */
.card{
  background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;
}
.card-header{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:16px;margin-bottom:18px;flex-wrap:wrap;
}
.card-title{font-size:16px;font-weight:700;color:#111827}
.card-sub{font-size:13px;color:#6b7280;margin-top:3px}

/* Status messages */
.msg-banner{
  padding:11px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;
}
.msg-ok{background:#d1fae5;border:1px solid #86efac;color:#065f46}
.msg-err{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b}

/* Button group */
.btn-group{display:flex;gap:8px}
.btn-ghost{
  padding:8px 14px;border-radius:7px;
  background:#f9fafb;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;cursor:pointer;
  transition:all .15s;
}
.btn-ghost:hover{background:#f3f4f6}
.btn-ghost:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{
  padding:8px 14px;border-radius:7px;
  background:#f97316;color:#fff;border:none;
  font-size:13px;font-weight:600;cursor:pointer;
  box-shadow:0 1px 3px rgba(249,115,22,.3);
  transition:all .15s;
}
.btn-primary:hover:not(:disabled){background:#ea580c}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}

/* ── Detail Grid ────────────────────────────────────────────────────────────── */
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.detail-item{
  display:flex;flex-direction:column;gap:5px;
  padding:14px;border-radius:8px;
  background:#f9fafb;border:1px solid #f3f4f6;
}
.detail-full{grid-column:1/-1}
.detail-label{
  font-size:11px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:#9ca3af;
}
.detail-value{font-size:14px;font-weight:600;color:#111827}
.mono-val{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.04em}

/* ── Preferences ─────────────────────────────────────────────────────────── */
.pref-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pref-field{display:flex;flex-direction:column;gap:7px}
.pref-field span{font-size:12px;font-weight:600;color:#6b7280}
.pref-select{
  padding:10px 12px;border-radius:8px;
  border:1.5px solid #e5e7eb;background:#fff;
  font-size:14px;color:#111827;
  transition:border-color .15s;
}
.pref-select:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.1)}

/* ── Toggles ────────────────────────────────────────────────────────────── */
.toggle-list{display:flex;flex-direction:column;gap:10px}
.toggle-row{
  display:flex;align-items:center;justify-content:space-between;gap:20px;
  padding:16px;border-radius:8px;background:#f9fafb;border:1px solid #f3f4f6;
}
.toggle-text strong{display:block;font-size:14px;font-weight:600;color:#111827;margin-bottom:2px}
.toggle-text span{font-size:13px;color:#6b7280}
.switch{position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0}
.switch input{opacity:0;width:0;height:0}
.slider{
  position:absolute;cursor:pointer;inset:0;
  background:#d1d5db;border-radius:34px;transition:.3s;
}
.slider:before{
  content:'';position:absolute;height:18px;width:18px;
  left:3px;bottom:3px;background:#fff;border-radius:50%;
  transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,.15);
}
input:checked + .slider{background:#10b981}
input:checked + .slider:before{transform:translateX(20px)}

/* ── Actions ─────────────────────────────────────────────────────────────── */
.actions-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.action-tile{
  display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:16px;border-radius:9px;background:#f9fafb;
  border:1px solid #e5e7eb;cursor:pointer;
  text-align:center;transition:all .15s;
}
.action-tile:hover{background:#f3f4f6;border-color:#d1d5db;transform:translateY(-1px)}
.action-tile strong{font-size:13px;font-weight:700;color:#111827}
.action-tile span{font-size:12px;color:#6b7280}
.tile-icon{
  width:40px;height:40px;border-radius:9px;
  display:flex;align-items:center;justify-content:center;
}
.tile-blue{background:#dbeafe;color:#1d4ed8}
.tile-green{background:#d1fae5;color:#065f46}
.tile-orange{background:#ffedd5;color:#ea580c}

/* ── Danger Zone ─────────────────────────────────────────────────────────── */
.danger-list{display:flex;flex-direction:column;gap:12px}
.danger-row{
  display:flex;align-items:center;justify-content:space-between;gap:20px;
  padding:16px;border-radius:8px;background:#f9fafb;border:1px solid #f3f4f6;
}
.danger-row strong{display:block;font-size:14px;font-weight:600;color:#111827;margin-bottom:3px}
.danger-row p{font-size:13px;color:#6b7280}
.btn-danger{
  padding:9px 16px;border-radius:7px;
  background:#fee2e2;border:1px solid #fca5a5;
  color:#dc2626;font-size:13px;font-weight:600;cursor:pointer;
  transition:all .15s;flex-shrink:0;
}
.btn-danger:hover{background:#fecaca}

/* ── States ──────────────────────────────────────────────────────────────── */
.center-state{
  display:flex;flex-direction:column;align-items:center;
  gap:12px;padding:60px 20px;text-align:center;color:#6b7280;font-size:14px;
}
.spinner{
  width:28px;height:28px;border-radius:50%;
  border:3px solid #e5e7eb;border-top-color:#f97316;
  animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:640px){
  .page{padding:16px 12px 90px}
  .detail-grid,.pref-grid{grid-template-columns:1fr}
  .detail-full,.pref-field{grid-column:1}
  .actions-row{grid-template-columns:1fr}
  .danger-row{flex-direction:column;align-items:flex-start}
  .profile-hero{flex-wrap:wrap}
  .logout-btn{order:1;width:100%;justify-content:center}
}
`;
