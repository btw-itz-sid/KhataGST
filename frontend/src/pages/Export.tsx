// ─────────────────────────────────────────────────────────────────────────────
// Export.tsx — GSTR Data Export Page
// User yahan apna GST data Excel ya CSV format mein download kar sakta hai
// Month aur year select karo, format choose karo, download karo
// Koi mock data nahi — real business data download hota hai
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

// Route type
type Route = "dashboard" | "export";

// Props — navigate function
interface Props {
  navigate: (route: Route) => void;
}

// Export format types
type ExportType = "excel" | "csv";

// Status message after download attempt
interface StatusMsg {
  ok: boolean;
  text: string;
}

// Backend base URL
const BASE_URL = "/api/v1";

// Mahino ke naam
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Current date info
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();

// Year options — 2 saal pehle se 2 saal baad tak
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

// ─────────────────────────────────────────────────────────────────────────────
// Main Export Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Export({ navigate }: Props) {
  // Selected period
  const [month, setMonth] = useState(NOW.getMonth());
  const [year, setYear] = useState(CURRENT_YEAR);

  // Download loading state per format
  const [loading, setLoading] = useState<ExportType | null>(null);

  // Status message after download
  const [status, setStatus] = useState<StatusMsg | null>(null);

  // Session info
  const business = getBusinessContext();
  const token = getToken();
  const businessName = business?.name || "Your Business";

  // Period code jo API ko bhejte hain (e.g., "042025")
  const periodCode = `${String(month + 1).padStart(2, "0")}${year}`;

  // tax_period format for API (e.g., "2025-04")
  const taxPeriod = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Label for display
  const periodLabel = `${MONTHS[month]} ${year}`;

  // ── Download function ──────────────────────────────────────────────────
  async function download(type: ExportType) {
    // Session check karo
    if (!token || !business?.id) {
      setStatus({ ok: false, text: "Session expire ho gayi. Dashboard pe jao aur dobara sign in karo." });
      return;
    }

    setLoading(type);
    setStatus(null);

    try {
      const res = await fetch(
        `${BASE_URL}/export/${type}?business_id=${business.id}&tax_period=${taxPeriod}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Export fail hua.");

      // Blob download — browser automatically file save karega
      const blob = await res.blob();
      const ext = type === "excel" ? "xlsx" : "csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KhataGST_${MONTHS[month]}_${year}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus({
        ok: true,
        text: `${type === "excel" ? "Excel workbook" : "CSV file"} download shuru ho gayi — ${periodLabel}.`,
      });
    } catch {
      setStatus({ ok: false, text: "Export fail hua. Backend check karo aur dobara try karo." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Top Navigation ─────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">GSTR Export</div>
        <div style={{ width: 90 }} />
      </header>

      <main className="page">

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="page-header">
          <div className="page-eyebrow">Compliance Export</div>
          <h1 className="page-title">Download filing data</h1>
          <p className="page-desc">
            Select a GST period and download a filing-ready workbook or raw CSV for{" "}
            <strong>{businessName}</strong>.
          </p>
        </div>

        {/* ── Status Banner ──────────────────────────────────────────── */}
        {status && (
          <div className={`banner ${status.ok ? "banner-ok" : "banner-err"}`}>
            {status.ok ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            {status.text}
          </div>
        )}

        {/* ── Period Selector ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-title">Select Filing Period</div>

          <div className="period-grid">
            {/* Month selector */}
            <label className="field-label">
              <span>Month</span>
              <select
                className="select-input"
                value={month}
                onChange={(e) => { setMonth(Number(e.target.value)); setStatus(null); }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </label>

            {/* Year selector */}
            <label className="field-label">
              <span>Year</span>
              <select
                className="select-input"
                value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setStatus(null); }}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Period summary bar */}
          <div className="period-bar">
            <div className="period-info">
              <span className="period-name">{periodLabel}</span>
              <span className="period-sub">Period code: {periodCode} · {businessName}</span>
            </div>
            <span className="period-badge">{periodCode}</span>
          </div>
        </div>

        {/* ── Format Cards ─────────────────────────────────────────────── */}
        <div className="section-label">Choose Format</div>

        <div className="format-grid">

          {/* ── EXCEL CARD ───────────────────────────────────────────── */}
          <div className="format-card">
            <div className="format-top">
              <div className="format-badge format-badge-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M7 8l4 4-4 4M13 16h4"/>
                </svg>
                XLSX
              </div>
              <span className="tag-recommended">Recommended</span>
            </div>

            <h2 className="format-title">GSTR-1 Workbook</h2>
            <p className="format-desc">
              A structured Excel file for GST portal preparation. Contains
              Summary, B2B, and B2C tabs — best for direct filing or sharing
              with your CA.
            </p>

            <ul className="format-features">
              <li>
                <span className="feat-dot feat-green" />
                GSTR-1 style sheet layout
              </li>
              <li>
                <span className="feat-dot feat-green" />
                B2B, B2C, and summary tabs
              </li>
              <li>
                <span className="feat-dot feat-green" />
                Ready for portal upload review
              </li>
            </ul>

            <button
              className="download-btn download-btn-green"
              onClick={() => download("excel")}
              disabled={loading !== null}
              id="download-excel-btn"
            >
              {loading === "excel" ? (
                <>
                  <div className="btn-spinner btn-spinner-green" />
                  Preparing…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
                    <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
                  </svg>
                  Download Excel (.xlsx)
                </>
              )}
            </button>
          </div>

          {/* ── CSV CARD ─────────────────────────────────────────────── */}
          <div className="format-card">
            <div className="format-top">
              <div className="format-badge format-badge-blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 3.5V8h4.5"/><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
                  <path d="M9 12h6"/><path d="M9 16h4"/>
                </svg>
                CSV
              </div>
            </div>

            <h2 className="format-title">Raw Accountant Export</h2>
            <p className="format-desc">
              A clean flat-file export for CAs, accountants, and reconciliation.
              Row-level data — easy to import into any spreadsheet tool.
            </p>

            <ul className="format-features">
              <li>
                <span className="feat-dot feat-blue" />
                Flat row-level invoice data
              </li>
              <li>
                <span className="feat-dot feat-blue" />
                Easy to share with external CA
              </li>
              <li>
                <span className="feat-dot feat-blue" />
                Works with Excel, Sheets, Tally
              </li>
            </ul>

            <button
              className="download-btn download-btn-blue"
              onClick={() => download("csv")}
              disabled={loading !== null}
              id="download-csv-btn"
            >
              {loading === "csv" ? (
                <>
                  <div className="btn-spinner btn-spinner-blue" />
                  Preparing…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
                    <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
                  </svg>
                  Download CSV (.csv)
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Pre-filing Checklist ────────────────────────────────────── */}
        <div className="card">
          <div className="card-title">Before You File</div>
          <div className="checklist">
            {[
              ["Review taxable totals", "Invoice values final hain toh hi export karo — jo portal pe file karna hai."],
              ["Check invoice dates", "Export period-bound hota hai — late-dated invoices filing mein affect kar sakte hain."],
              ["Share the right file", "Excel portal prep ke liye. CSV agar CA ko raw rows chahiye."],
            ].map(([title, desc]) => (
              <div key={title} className="checklist-item">
                <div className="check-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Same design system as all pages
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{background:#f9fafb;font-family:'Inter',sans-serif;color:#111827;-webkit-font-smoothing:antialiased}
button,input,select{font-family:inherit;outline:none}

/* ── Topbar ──────────────────────────────────────────────────────────────── */
.topbar{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;gap:16px;
  padding:0 20px;height:56px;
  background:#fff;border-bottom:1px solid #e5e7eb;
}
.topbar-brand{
  font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;
  color:#111827;flex:1;text-align:center;
}
.back-btn{
  padding:7px 12px;border-radius:7px;
  background:#f9fafb;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;
  cursor:pointer;transition:all .15s;
}
.back-btn:hover{background:#f3f4f6}

/* ── Page Layout ─────────────────────────────────────────────────────────── */
.page{
  max-width:720px;margin:0 auto;
  padding:28px 20px 100px;
  display:flex;flex-direction:column;gap:16px;
}

/* ── Page Header ──────────────────────────────────────────────────────────── */
.page-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:#9ca3af;margin-bottom:6px;
}
.page-title{font-size:24px;font-weight:800;color:#111827;margin-bottom:6px;letter-spacing:-.02em}
.page-desc{font-size:14px;color:#6b7280;line-height:1.6}

/* ── Banner ──────────────────────────────────────────────────────────────── */
.banner{
  display:flex;align-items:center;gap:10px;
  padding:12px 16px;border-radius:9px;
  font-size:14px;font-weight:500;
}
.banner-ok{background:#d1fae5;border:1px solid #6ee7b7;color:#065f46}
.banner-err{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b}

/* ── Card ──────────────────────────────────────────────────────────────────── */
.card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;
}
.card-title{
  font-size:13px;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:#6b7280;margin-bottom:14px;
}

/* ── Period Selector ──────────────────────────────────────────────────────── */
.period-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.field-label{display:flex;flex-direction:column;gap:6px}
.field-label span{font-size:12px;font-weight:600;color:#6b7280}
.select-input{
  padding:10px 12px;border-radius:8px;
  border:1.5px solid #e5e7eb;background:#fff;
  font-size:14px;color:#111827;cursor:pointer;
  transition:border-color .15s;
}
.select-input:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.1)}

/* Period bar */
.period-bar{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:14px 16px;border-radius:8px;
  background:#0f172a;color:#fff;
}
.period-info{display:flex;flex-direction:column;gap:3px}
.period-name{font-size:16px;font-weight:700}
.period-sub{font-size:12px;color:rgba(255,255,255,.5)}
.period-badge{
  font-family:'JetBrains Mono',monospace;
  font-size:20px;font-weight:700;color:#f97316;
  flex-shrink:0;
}

/* ── Section Label ────────────────────────────────────────────────────────── */
.section-label{
  font-size:12px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:#6b7280;padding:0 2px;
}

/* ── Format grid ──────────────────────────────────────────────────────────── */
.format-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.format-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:20px;display:flex;flex-direction:column;gap:14px;
  transition:box-shadow .2s,transform .2s;
}
.format-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.06);transform:translateY(-2px)}

/* Format card top row */
.format-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.format-badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 12px;border-radius:7px;
  font-size:12px;font-weight:700;letter-spacing:.04em;
}
.format-badge-green{background:#d1fae5;color:#065f46}
.format-badge-blue{background:#dbeafe;color:#1e40af}
.tag-recommended{
  font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 9px;border-radius:5px;
  background:#ffedd5;color:#ea580c;
}

/* Format card content */
.format-title{font-size:17px;font-weight:700;color:#111827;line-height:1.2}
.format-desc{font-size:13px;color:#6b7280;line-height:1.65;flex:1}

/* Feature list */
.format-features{list-style:none;display:flex;flex-direction:column;gap:8px}
.format-features li{display:flex;align-items:center;gap:8px;font-size:13px;color:#374151}
.feat-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.feat-green{background:#10b981}
.feat-blue{background:#3b82f6}

/* Download buttons */
.download-btn{
  width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  padding:12px 16px;border-radius:8px;
  font-size:14px;font-weight:700;cursor:pointer;border:none;
  transition:all .15s;
}
.download-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.download-btn-green{
  background:#059669;color:#fff;
  box-shadow:0 1px 3px rgba(5,150,105,.25);
}
.download-btn-green:hover:not(:disabled){background:#047857;box-shadow:0 6px 20px rgba(5,150,105,.3);transform:translateY(-1px)}
.download-btn-blue{
  background:#2563eb;color:#fff;
  box-shadow:0 1px 3px rgba(37,99,235,.25);
}
.download-btn-blue:hover:not(:disabled){background:#1d4ed8;box-shadow:0 6px 20px rgba(37,99,235,.3);transform:translateY(-1px)}

/* Button spinner */
.btn-spinner{
  width:14px;height:14px;border-radius:50%;
  border:2px solid rgba(255,255,255,.3);
  animation:spin .7s linear infinite;flex-shrink:0;
}
.btn-spinner-green{border-top-color:#fff}
.btn-spinner-blue{border-top-color:#fff}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Pre-filing Checklist ─────────────────────────────────────────────────── */
.checklist{display:flex;flex-direction:column;gap:12px}
.checklist-item{display:flex;gap:12px;align-items:flex-start}
.check-icon{
  width:26px;height:26px;border-radius:7px;flex-shrink:0;
  background:#d1fae5;display:flex;align-items:center;justify-content:center;
  color:#059669;margin-top:1px;
}
.checklist-item strong{display:block;font-size:13px;font-weight:700;color:#111827;margin-bottom:2px}
.checklist-item p{font-size:13px;color:#6b7280;line-height:1.55}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:640px){
  .page{padding:20px 14px 100px}
  .topbar{padding:0 14px}
  .format-grid,.period-grid{grid-template-columns:1fr}
  .period-bar{flex-direction:column;align-items:flex-start;gap:8px}
}
`;
