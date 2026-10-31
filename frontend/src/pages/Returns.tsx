import { useState } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { getBusinessContext } from "../lib/session";

type Route = "dashboard" | "export" | "invoices";

interface Props {
  navigate: (route: Route) => void;
}

type ExportType = "excel" | "csv" | "json";

interface StatusMsg {
  ok: boolean;
  text: string;
}

interface Gstr1Preview {
  id?: string;
  due_date?: string;
  status?: string;
  b2b?: Array<{
    buyer_name?: string;
    buyer_gstin?: string;
    invoice_number?: string;
    taxable_value?: number;
    total?: number;
  }>;
  b2c?: Array<{
    place_of_supply?: string;
    gst_rate?: string;
    taxable_value?: number;
  }>;
  totals?: {
    total_invoices?: number;
    taxable_value?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    total_tax?: number;
    grand_total?: number;
  };
  summary_readable?: {
    total_invoices?: number;
    taxable_value?: string;
    total_tax?: string;
    grand_total?: string;
    due_date?: string;
  };
}

interface Gstr3bPreview {
  id?: string;
  due_date?: string;
  status?: string;
  outward_supplies?: {
    taxable_value?: number;
    total_tax?: number;
  };
  inward_supplies?: {
    taxable_value?: number;
    total_itc?: number;
    blocked_itc?: number;
    rcm_tax?: number;
  };
  net_tax_payable?: {
    total?: number;
  };
  totals_readable?: {
    outward_tax?: string;
    itc_available?: string;
    blocked_itc?: string;
    net_payable?: string;
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function formatPaise(paise: number | undefined): string {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Returns({ navigate }: Props) {
  const [month, setMonth] = useState(NOW.getMonth());
  const [year, setYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState<ExportType | "gstr1" | "gstr3b" | "prepare" | null>(null);
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [gstr1, setGstr1] = useState<Gstr1Preview | null>(null);
  const [gstr3b, setGstr3b] = useState<Gstr3bPreview | null>(null);

  const business = getBusinessContext();
  const businessName = business?.name || "Your Business";
  const taxPeriod = `${year}-${String(month + 1).padStart(2, "0")}`;
  const periodLabel = `${MONTHS[month]} ${year}`;

  async function computeReturn(kind: "gstr1" | "gstr3b") {
    if (!business?.id) {
      setStatus({ ok: false, text: "Session expire ho gayi. Dobara sign in karo." });
      return;
    }

    setLoading(kind);
    setStatus(null);

    try {
      const res = await apiFetch(`/returns/${kind}/compute`, {
        method: "POST",
        body: JSON.stringify({ business_id: business.id, tax_period: taxPeriod }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(payload, `${kind.toUpperCase()} compute fail hua.`));
      }

      if (kind === "gstr1") {
        setGstr1(payload?.gstr1 ?? null);
      } else {
        setGstr3b(payload?.gstr3b ?? null);
      }
      setStatus({
        ok: true,
        text: `${kind === "gstr1" ? "GSTR-1" : "GSTR-3B"} ready for ${periodLabel}. GST portal pe file nahi hua.`,
      });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Compute fail hua." });
    } finally {
      setLoading(null);
    }
  }

  async function markPrepared(id?: string, label?: string) {
    if (!id) {
      setStatus({ ok: false, text: "Pehle return compute karo." });
      return;
    }

    setLoading("prepare");
    setStatus(null);
    try {
      const res = await apiFetch(`/returns/${id}/prepare`, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(getApiErrorMessage(payload, "Prepare fail hua."));
      }
      setStatus({
        ok: true,
        text: `${label ?? "Return"} prepared. CA ko Excel/JSON share karo — KhataGST GSTN pe file nahi karta.`,
      });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Prepare fail hua." });
    } finally {
      setLoading(null);
    }
  }

  async function download(type: ExportType) {
    if (!business?.id) {
      setStatus({ ok: false, text: "Session expire ho gayi. Dashboard pe jao aur dobara sign in karo." });
      return;
    }

    setLoading(type);
    setStatus(null);

    try {
      const res = await apiFetch(
        `/export/${type}?business_id=${business.id}&tax_period=${taxPeriod}`
      );
      if (!res.ok) throw new Error("Export fail hua.");

      const blob = await res.blob();
      const ext = type === "excel" ? "xlsx" : type === "csv" ? "csv" : "json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = type === "json"
        ? `KhataGST_CA_pack_${year}_${String(month + 1).padStart(2, "0")}.json`
        : `KhataGST_${MONTHS[month]}_${year}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus({
        ok: true,
        text: type === "json"
          ? `CA pack download shuru — ${periodLabel}.`
          : `${type === "excel" ? "Excel" : "CSV"} download shuru — ${periodLabel}.`,
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
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">GST Returns</div>
        <button className="back-btn" onClick={() => navigate("invoices")}>
          Invoices
        </button>
      </header>

      <main className="page">
        <div className="page-header">
          <div className="page-eyebrow">Return prep · रिटर्न तैयारी</div>
          <h1 className="page-title">Preview GSTR-1 & GSTR-3B</h1>
          <p className="page-desc">
            <strong>{businessName}</strong> ke liye period compute karo, numbers check karo,
            phir CA ko pack share karo. KhataGST data taiyar karta hai — GST portal pe file nahi karta.
          </p>
        </div>

        {status && (
          <div className={`banner ${status.ok ? "banner-ok" : "banner-err"}`}>
            {status.text}
          </div>
        )}

        <div className="card">
          <div className="card-title">Select period</div>
          <div className="period-grid">
            <label className="field-label">
              <span>Month</span>
              <select
                className="select-input"
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  setStatus(null);
                  setGstr1(null);
                  setGstr3b(null);
                }}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              <span>Year</span>
              <select
                className="select-input"
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setStatus(null);
                  setGstr1(null);
                  setGstr3b(null);
                }}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="period-bar">
            <div className="period-info">
              <span className="period-name">{periodLabel}</span>
              <span className="period-sub">Tax period {taxPeriod} · {businessName}</span>
            </div>
            <span className="period-badge">{taxPeriod}</span>
          </div>
        </div>

        <div className="compute-grid">
          <div className="card">
            <div className="card-title">GSTR-1 outward supplies</div>
            <p className="card-copy">Sales invoices for this month, split into B2B and B2C.</p>
            <button
              className="btn-pri"
              onClick={() => computeReturn("gstr1")}
              disabled={loading !== null}
            >
              {loading === "gstr1" ? "Computing…" : "Compute GSTR-1"}
            </button>
            {gstr1 && (
              <>
                <div className="kpi-row">
                  <div>
                    <span>Invoices</span>
                    <strong>{gstr1.totals?.total_invoices ?? gstr1.summary_readable?.total_invoices ?? 0}</strong>
                  </div>
                  <div>
                    <span>Taxable</span>
                    <strong>{gstr1.summary_readable?.taxable_value ?? formatPaise(gstr1.totals?.taxable_value)}</strong>
                  </div>
                  <div>
                    <span>Tax</span>
                    <strong>{gstr1.summary_readable?.total_tax ?? formatPaise(gstr1.totals?.total_tax)}</strong>
                  </div>
                </div>
                <p className="mini">{gstr1.b2b?.length ?? 0} B2B · {gstr1.b2c?.length ?? 0} B2C rate groups · due {gstr1.due_date ?? gstr1.summary_readable?.due_date ?? "—"}</p>
                <button
                  className="btn-sec"
                  onClick={() => markPrepared(gstr1.id, "GSTR-1")}
                  disabled={loading !== null || !gstr1.id}
                >
                  {loading === "prepare" ? "Saving…" : "Mark GSTR-1 prepared"}
                </button>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">GSTR-3B tax payable</div>
            <p className="card-copy">Outward tax minus eligible ITC. Blocked 17(5) credit is excluded.</p>
            <button
              className="btn-pri"
              onClick={() => computeReturn("gstr3b")}
              disabled={loading !== null}
            >
              {loading === "gstr3b" ? "Computing…" : "Compute GSTR-3B"}
            </button>
            {gstr3b && (
              <>
                <div className="kpi-row">
                  <div>
                    <span>Outward tax</span>
                    <strong>{gstr3b.totals_readable?.outward_tax ?? formatPaise(gstr3b.outward_supplies?.total_tax)}</strong>
                  </div>
                  <div>
                    <span>Eligible ITC</span>
                    <strong>{gstr3b.totals_readable?.itc_available ?? formatPaise(gstr3b.inward_supplies?.total_itc)}</strong>
                  </div>
                  <div>
                    <span>Net payable</span>
                    <strong>{gstr3b.totals_readable?.net_payable ?? formatPaise(gstr3b.net_tax_payable?.total)}</strong>
                  </div>
                </div>
                <p className="mini">
                  Blocked ITC {gstr3b.totals_readable?.blocked_itc ?? formatPaise(gstr3b.inward_supplies?.blocked_itc)}
                  {Number(gstr3b.inward_supplies?.rcm_tax) ? ` · RCM ${formatPaise(gstr3b.inward_supplies?.rcm_tax)}` : ""}
                  {" · due "}
                  {gstr3b.due_date ?? "—"}
                </p>
                <button
                  className="btn-sec"
                  onClick={() => markPrepared(gstr3b.id, "GSTR-3B")}
                  disabled={loading !== null || !gstr3b.id}
                >
                  {loading === "prepare" ? "Saving…" : "Mark GSTR-3B prepared"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="section-label">CA ko share karo</div>
        <div className="format-grid">
          <div className="format-card">
            <h2 className="format-title">Excel workbook</h2>
            <p className="format-desc">Summary, B2B, aur B2C sheets — CA review ke liye. Official GSTN JSON nahi hai.</p>
            <button className="download-btn download-btn-green" onClick={() => download("excel")} disabled={loading !== null}>
              {loading === "excel" ? "Preparing…" : "Download Excel (.xlsx)"}
            </button>
          </div>
          <div className="format-card">
            <h2 className="format-title">CSV for accountant</h2>
            <p className="format-desc">Flat invoice rows — spreadsheet mein import ya CA ko bhejo.</p>
            <button className="download-btn download-btn-blue" onClick={() => download("csv")} disabled={loading !== null}>
              {loading === "csv" ? "Preparing…" : "Download CSV (.csv)"}
            </button>
          </div>
          <div className="format-card">
            <h2 className="format-title">Share with CA (JSON)</h2>
            <p className="format-desc">
              GSTR-1 + GSTR-3B + invoices + ITC flags — ek CA pack. Portal filing nahi.
            </p>
            <button className="download-btn download-btn-orange" onClick={() => download("json")} disabled={loading !== null}>
              {loading === "json" ? "Preparing…" : "Download CA pack (.json)"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f9fafb;font-family:'Inter',sans-serif;color:#111827}
button,input,select{font-family:inherit;outline:none}
.topbar{position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:16px;padding:0 20px;height:56px;background:#fff;border-bottom:1px solid #e5e7eb}
.topbar-brand{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:#111827;flex:1;text-align:center}
.back-btn{padding:7px 12px;border-radius:7px;background:#f9fafb;border:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#374151;cursor:pointer}
.page{max-width:860px;margin:0 auto;padding:28px 20px 100px;display:flex;flex-direction:column;gap:16px}
.page-eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px}
.page-title{font-size:24px;font-weight:800;color:#111827;margin-bottom:6px}
.page-desc{font-size:14px;color:#6b7280;line-height:1.6}
.banner{padding:12px 16px;border-radius:9px;font-size:14px;font-weight:500}
.banner-ok{background:#d1fae5;border:1px solid #6ee7b7;color:#065f46}
.banner-err{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px}
.card-title{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}
.card-copy{font-size:13px;color:#6b7280;line-height:1.55}
.period-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field-label{display:flex;flex-direction:column;gap:6px}
.field-label span{font-size:12px;font-weight:600;color:#6b7280}
.select-input{padding:10px 12px;border-radius:8px;border:1.5px solid #e5e7eb;background:#fff;font-size:14px}
.period-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-radius:8px;background:#0f172a;color:#fff}
.period-name{font-size:16px;font-weight:700}
.period-sub{font-size:12px;color:rgba(255,255,255,.5)}
.period-badge{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:#f97316}
.compute-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.format-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.btn-pri,.btn-sec,.download-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:8px;font-size:14px;font-weight:700;border:none;cursor:pointer}
.btn-pri{background:#f97316;color:#fff}
.btn-sec{background:#fff;color:#374151;border:1px solid #d1d5db}
.btn-pri:disabled,.btn-sec:disabled,.download-btn:disabled{opacity:.6;cursor:not-allowed}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.kpi-row span{display:block;font-size:11px;color:#9ca3af;font-weight:600}
.kpi-row strong{font-family:'JetBrains Mono',monospace;font-size:13px}
.mini{font-size:12px;color:#6b7280}
.section-label{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}
.format-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px}
.format-title{font-size:17px;font-weight:700}
.format-desc{font-size:13px;color:#6b7280;line-height:1.6;flex:1}
.download-btn-green{background:#059669;color:#fff}
.download-btn-blue{background:#2563eb;color:#fff}
.download-btn-orange{background:#ea580c;color:#fff}
@media(max-width:900px){
  .format-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:640px){
  .page{padding:20px 14px 100px}
  .compute-grid,.format-grid,.period-grid,.kpi-row{grid-template-columns:1fr}
}
`;
