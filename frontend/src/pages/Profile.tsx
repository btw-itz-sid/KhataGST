import "./Profile.css";
// ─────────────────────────────────────────────────────────────────────────────
// Profile.tsx — Business Settings & Account Page
// User apna business info dekh sakta hai, edit kar sakta hai
// Team access, notification preferences, aur logout bhi yahan hai
// Sab real API se — koi hardcoded user nahi
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { clearSession, getBusinessContext, getToken } from "../lib/session";

// Route type
type Route = "gst-rates" | "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";

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

import { BASE_URL } from "../lib/api";

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
  const preferenceKey="khatagst_preferences:"+(getBusinessContext()?.id || "personal");
  const [notifs, setNotifs] = useState<NotifPrefs>(()=>{
    try {const value=JSON.parse(localStorage.getItem(preferenceKey)||"{}");return {emailAlerts:value.emailAlerts===true,smsAlerts:value.smsAlerts===true,monthlyReports:value.monthlyReports===true};}
    catch{return {emailAlerts:false,smsAlerts:false,monthlyReports:false};}
  });
  useEffect(()=>{try{localStorage.setItem(preferenceKey,JSON.stringify(notifs));}catch{/* Storage may be unavailable in private browsing. */}},[notifs,preferenceKey]);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteAccount() {
    const ok = window.confirm(
      "Account permanently delete karna hai? Saara business data chala jayega."
    );
    if (!ok) return;
    const typed = window.prompt('Confirm ke liye DELETE type karo (capital letters):');
    if (typed !== "DELETE") {
      setSaveMsg({ ok: false, text: "Delete cancel — DELETE type karna zaroori hai." });
      return;
    }

    setDeleting(true);
    setSaveMsg(null);
    try {
      const res = await apiFetch("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(payload, "Account delete fail hua."));
      }
      clearSession();
      onLogout();
    } catch (err) {
      setSaveMsg({
        ok: false,
        text: err instanceof Error ? err.message : "Account delete fail hua.",
      });
    } finally {
      setDeleting(false);
    }
  }

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
                    <button className="action-tile" onClick={()=>navigate("gst-rates")}><strong>GST reference rates</strong><span>Browse HSN / SAC codes</span></button>
                    <button className="action-tile" onClick={() => navigate("export")}>
                      <div className="tile-icon tile-blue">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
                          <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
                        </svg>
                      </div>
                      <strong>GST Returns</strong>
                      <span>Preview GSTR-1 / 3B</span>
                    </button>
                    <button className="action-tile" onClick={() => navigate("pricing")}>
                      <div className="tile-icon tile-orange">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                      </div>
                      <strong>Plans & billing</strong>
                      <span>Upgrade with Razorpay</span>
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

                  <p className="local-preferences-note">Saved on this device. Notification delivery and automatic reports are not enabled by these preferences.</p>
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
                      desc="Preference for future monthly report delivery."
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
                      <select className="pref-select" disabled defaultValue="monthly" title="Filing frequency is a reference setting; workflow configuration is not available yet">
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

                    <div className="danger-row">
                      <div>
                        <strong>Delete Account</strong>
                        <p>
                          Permanent — business, invoices, scans, aur 2B data sab hat jayega.
                          Wapas nahi aayega.
                        </p>
                      </div>
                      <button
                        className="btn-danger"
                        disabled={deleting}
                        onClick={() => void handleDeleteAccount()}
                      >
                        {deleting ? "Deleting…" : "Delete Account"}
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
        <input aria-label={label} type="checkbox" checked={checked} onChange={onChange} />
        <span className="slider" />
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Same design system as other pages
// ─────────────────────────────────────────────────────────────────────────────
