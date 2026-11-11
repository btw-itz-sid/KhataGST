import { useEffect, useMemo, useState } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { getBusinessContext } from "../lib/session";

type Route = "dashboard" | "export" | "invoices" | "reconcile";

interface Props {
  navigate: (route: Route) => void;
}

type Bucket = "matched" | "mismatch" | "in_books_not_2b" | "in_2b_not_books";

interface Summary {
  matched: number;
  mismatch: number;
  in_books_not_2b: number;
  in_2b_not_books: number;
  risk_paise: number;
  claimable_matched_paise: number;
}

interface ReconRow {
  id: string;
  bucket: Bucket;
  supplier_gstin?: string;
  invoice_number?: string;
  books_taxable_paise?: number;
  portal_taxable_paise?: number;
  books_tax_paise?: number;
  portal_tax_paise?: number;
  risk_paise?: number;
  notes?: string;
  gstr2b_row_id?: string;
  ims_action?: "pending" | "accept" | "reject";
  ims_note?: string;
}

interface PortalRow {
  id: string;
  supplier_gstin?: string;
  supplier_name?: string;
  invoice_number: string;
  invoice_date?: string;
  taxable_paise?: number;
  total_paise?: number;
  ims_action: "pending" | "accept" | "reject";
  ims_note?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => NOW.getFullYear() - 2 + i);

const SAMPLE_2B = `{
  "tax_period": "REPLACE_PERIOD",
  "invoices": [
    {
      "supplier_gstin": "27AABCU9603R1ZM",
      "supplier_name": "Demo Supplier",
      "invoice_number": "S-100",
      "invoice_date": "2026-03-10",
      "taxable_value": 1000,
      "cgst": 90,
      "sgst": 90,
      "total": 1180
    }
  ]
}`;

function formatPaise(paise: number | undefined): string {
  return `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  matched: "Matched",
  mismatch: "Mismatch",
  in_books_not_2b: "In books, not in 2B",
  in_2b_not_books: "In 2B, not in books",
};

export default function Reconcile({ navigate }: Props) {
  const business = getBusinessContext();
  const [month, setMonth] = useState(NOW.getMonth());
  const [year, setYear] = useState(NOW.getFullYear());
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<ReconRow[]>([]);
  const [portalRows, setPortalRows] = useState<PortalRow[]>([]);
  const [filter, setFilter] = useState<"all" | Bucket>("all");

  const taxPeriod = `${year}-${String(month + 1).padStart(2, "0")}`;
  const periodLabel = `${MONTHS[month]} ${year}`;

  const filtered = useMemo(() => {
    if (filter === "all") return results;
    return results.filter((r) => r.bucket === filter);
  }, [results, filter]);

  async function loadExisting() {
    if (!business?.id) return;
    setLoading("load");
    try {
      const res = await apiFetch(
        `/reconcile/2b?business_id=${business.id}&tax_period=${taxPeriod}`
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Reconcile load fail"));
      setSummary(payload.summary ?? null);
      setResults(payload.results ?? []);
      setPortalRows(payload.portal_rows ?? []);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Load fail" });
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    void loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxPeriod, business?.id]);

  async function uploadAndReconcile() {
    if (!business?.id) {
      setStatus({ ok: false, text: "Session expire — dobara login karo." });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setStatus({ ok: false, text: "JSON invalid hai. Portal JSON ya sample paste karo." });
      return;
    }

    setLoading("upload");
    setStatus(null);
    try {
      const res = await apiFetch("/reconcile/2b/upload", {
        method: "POST",
        body: JSON.stringify({
          business_id: business.id,
          tax_period: taxPeriod,
          gstr2b: parsed,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "2B upload fail"));
      setStatus({ ok: true, text: payload.message || "Reconcile complete." });
      setSummary(payload.summary ?? null);
      await loadExisting();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Upload fail" });
    } finally {
      setLoading(null);
    }
  }

  async function recompute() {
    if (!business?.id) return;
    setLoading("recompute");
    try {
      const res = await apiFetch("/reconcile/2b/recompute", {
        method: "POST",
        body: JSON.stringify({ business_id: business.id, tax_period: taxPeriod }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Recompute fail"));
      setSummary(payload.summary ?? null);
      setStatus({ ok: true, text: "Books vs 2B dubara match ho gaya." });
      await loadExisting();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Recompute fail" });
    } finally {
      setLoading(null);
    }
  }

  async function setIms(rowId: string, action: "accept" | "reject" | "pending") {
    setLoading(`ims-${rowId}`);
    try {
      const res = await apiFetch(`/reconcile/ims/${rowId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "IMS update fail"));
      setStatus({ ok: true, text: payload.message || "IMS updated" });
      await loadExisting();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "IMS fail" });
    } finally {
      setLoading(null);
    }
  }

  function fillSample() {
    setJsonText(SAMPLE_2B.replace("REPLACE_PERIOD", taxPeriod));
  }

  return (
    <>
      <style>{STYLES}</style>
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>← Dashboard</button>
        <div className="topbar-brand">2B Reconcile</div>
        <button className="back-btn" onClick={() => navigate("export")}>Returns</button>
      </header>

      <main className="page">
        <div className="page-header">
          <div className="page-eyebrow">Notice prevention · नोटिस बचाव</div>
          <h1 className="page-title">GSTR-2B vs your books</h1>
          <p className="page-desc">
            Portal se 2B JSON upload karo. KhataGST batayega kaunsa ITC claim safe hai,
            aur kaunsa DRC-01C notice invite karega. Live GSTN filing nahi — pehle risk kill karo.
          </p>
        </div>

        {status && (
          <div className={`banner ${status.ok ? "banner-ok" : "banner-err"}`}>{status.text}</div>
        )}

        <div className="card">
          <div className="card-title">Period</div>
          <div className="period-grid">
            <label className="field">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Year</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div className="period-chip">{periodLabel} · {taxPeriod}</div>
        </div>

        <div className="card">
          <div className="card-title">Upload GSTR-2B JSON</div>
          <p className="card-copy">
            GST portal → Returns → GSTR-2B → Download JSON. Ya demo sample paste karo.
          </p>
          <textarea
            className="json-box"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"b2b":[{"ctin":"...","inv":[...]}]}'
            rows={8}
          />
          <div className="btn-row">
            <button className="btn-sec" onClick={fillSample} disabled={loading !== null}>Sample JSON</button>
            <button className="btn-sec" onClick={() => void recompute()} disabled={loading !== null}>
              {loading === "recompute" ? "Matching…" : "Re-match books"}
            </button>
            <button className="btn-pri" onClick={() => void uploadAndReconcile()} disabled={loading !== null || !jsonText.trim()}>
              {loading === "upload" ? "Reconciling…" : "Upload & reconcile"}
            </button>
          </div>
        </div>

        {summary && (
          <div className="kpi-grid">
            <button className={`kpi ${filter === "matched" ? "kpi-on" : ""}`} onClick={() => setFilter("matched")}>
              <span>Matched</span>
              <strong>{summary.matched}</strong>
              <em>{formatPaise(summary.claimable_matched_paise)} tax</em>
            </button>
            <button className={`kpi kpi-warn ${filter === "mismatch" ? "kpi-on" : ""}`} onClick={() => setFilter("mismatch")}>
              <span>Mismatch</span>
              <strong>{summary.mismatch}</strong>
              <em>Fix before claim</em>
            </button>
            <button className={`kpi kpi-bad ${filter === "in_books_not_2b" ? "kpi-on" : ""}`} onClick={() => setFilter("in_books_not_2b")}>
              <span>Not in 2B</span>
              <strong>{summary.in_books_not_2b}</strong>
              <em>Defer ITC</em>
            </button>
            <button className={`kpi ${filter === "in_2b_not_books" ? "kpi-on" : ""}`} onClick={() => setFilter("in_2b_not_books")}>
              <span>Missing in books</span>
              <strong>{summary.in_2b_not_books}</strong>
              <em>Add purchase</em>
            </button>
            <div className="kpi kpi-risk">
              <span>Notice risk</span>
              <strong>{formatPaise(summary.risk_paise)}</strong>
              <em>Don’t claim this yet</em>
            </div>
            <button className={`kpi ${filter === "all" ? "kpi-on" : ""}`} onClick={() => setFilter("all")}>
              <span>Show all</span>
              <strong>{results.length}</strong>
              <em>Rows</em>
            </button>
          </div>
        )}

        <div className="card">
          <div className="card-title">
            {filter === "all" ? "Reconciliation matrix" : BUCKET_LABEL[filter]}
          </div>
          {loading === "load" && <p className="card-copy">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="card-copy">Is period ke liye abhi koi reconcile result nahi. 2B JSON upload karo.</p>
          )}
          <div className="matrix">
            {filtered.map((row) => (
              <div key={row.id} className={`row bucket-${row.bucket}`}>
                <div>
                  <div className="row-top">
                    <span className="badge">{BUCKET_LABEL[row.bucket]}</span>
                    <strong>{row.invoice_number || "—"}</strong>
                  </div>
                  <p className="mono">{row.supplier_gstin || "No GSTIN"}</p>
                  <p className="note">{row.notes}</p>
                </div>
                <div className="amounts">
                  <div><span>Books tax</span><strong>{formatPaise(row.books_tax_paise)}</strong></div>
                  <div><span>2B tax</span><strong>{formatPaise(row.portal_tax_paise)}</strong></div>
                  <div><span>Risk</span><strong>{formatPaise(row.risk_paise)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">IMS-style decisions</div>
          <p className="card-copy">
            Accept sirf tab jab books + 2B match ho. Reject = supplier se correction.
            Yeh portal IMS mirror hai — GSTN pe auto-push nahi hota.
          </p>
          {portalRows.length === 0 && (
            <p className="card-copy">Pehle 2B upload karo — IMS rows yahan aayengi.</p>
          )}
          <div className="matrix">
            {portalRows.map((row) => (
              <div key={row.id} className="row">
                <div>
                  <div className="row-top">
                    <span className={`badge ims-${row.ims_action}`}>{row.ims_action}</span>
                    <strong>{row.invoice_number}</strong>
                  </div>
                  <p className="mono">{row.supplier_gstin || "—"} · {row.supplier_name || "Supplier"}</p>
                  <p className="note">{formatPaise(row.taxable_paise)} taxable · {row.invoice_date?.toString().slice(0, 10) || "no date"}</p>
                </div>
                <div className="ims-actions">
                  <button
                    className="btn-tiny ok"
                    disabled={loading !== null}
                    onClick={() => void setIms(row.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    className="btn-tiny bad"
                    disabled={loading !== null}
                    onClick={() => void setIms(row.id, "reject")}
                  >
                    Reject
                  </button>
                  <button
                    className="btn-tiny"
                    disabled={loading !== null}
                    onClick={() => void setIms(row.id, "pending")}
                  >
                    Pending
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f8fafc;font-family:Inter,sans-serif;color:#0f172a}
button,input,select,textarea{font-family:inherit}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;background:#fff;border-bottom:1px solid #e2e8f0}
.topbar-brand{flex:1;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700}
.back-btn{padding:7px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:600;cursor:pointer}
.page{max-width:920px;margin:0 auto;padding:24px 16px 96px;display:flex;flex-direction:column;gap:14px}
.page-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.page-title{font-size:24px;font-weight:800;margin-bottom:6px}
.page-desc{font-size:14px;color:#64748b;line-height:1.55}
.banner{padding:12px 14px;border-radius:10px;font-size:14px;font-weight:600}
.banner-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
.banner-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:12px}
.card-title{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.card-copy{font-size:13px;color:#64748b;line-height:1.5}
.period-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#64748b}
.field select,.json-box{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;background:#fff}
.json-box{font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.45;resize:vertical}
.period-chip{display:inline-flex;align-self:flex-start;padding:8px 12px;border-radius:999px;background:#0f172a;color:#fff;font-size:12px;font-weight:700}
.btn-row{display:flex;flex-wrap:wrap;gap:8px}
.btn-pri,.btn-sec{padding:10px 14px;border-radius:9px;font-size:13px;font-weight:700;border:none;cursor:pointer}
.btn-pri{background:#ea580c;color:#fff}
.btn-sec{background:#fff;border:1px solid #cbd5e1;color:#334155}
.btn-pri:disabled,.btn-sec:disabled,.btn-tiny:disabled{opacity:.55;cursor:not-allowed}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.kpi{text-align:left;padding:14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;flex-direction:column;gap:4px}
.kpi span{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase}
.kpi strong{font-family:'JetBrains Mono',monospace;font-size:20px}
.kpi em{font-style:normal;font-size:12px;color:#64748b}
.kpi-on{border-color:#fb923c;box-shadow:0 0 0 2px rgba(251,146,60,.2)}
.kpi-warn strong{color:#b45309}
.kpi-bad strong{color:#b91c1c}
.kpi-risk{background:#0f172a;color:#fff;border-color:#0f172a;cursor:default}
.kpi-risk span,.kpi-risk em{color:#94a3b8}
.kpi-risk strong{color:#fdba74}
.matrix{display:flex;flex-direction:column;gap:8px}
.row{display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc}
.bucket-matched{border-color:#a7f3d0;background:#ecfdf5}
.bucket-mismatch{border-color:#fcd34d;background:#fffbeb}
.bucket-in_books_not_2b{border-color:#fecaca;background:#fef2f2}
.bucket-in_2b_not_books{border-color:#bfdbfe;background:#eff6ff}
.row-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:#e2e8f0;color:#334155}
.ims-accept{background:#d1fae5;color:#065f46}
.ims-reject{background:#fee2e2;color:#991b1b}
.ims-pending{background:#e2e8f0;color:#475569}
.mono{font-family:'JetBrains Mono',monospace;font-size:12px;color:#64748b}
.note{font-size:12px;color:#475569;margin-top:4px;line-height:1.4}
.amounts{display:grid;grid-template-columns:1fr;gap:6px;min-width:120px}
.amounts span{display:block;font-size:10px;color:#94a3b8;font-weight:700}
.amounts strong{font-family:'JetBrains Mono',monospace;font-size:12px}
.ims-actions{display:flex;flex-direction:column;gap:6px}
.btn-tiny{padding:7px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:12px;font-weight:700;cursor:pointer}
.btn-tiny.ok{background:#059669;border-color:#059669;color:#fff}
.btn-tiny.bad{background:#dc2626;border-color:#dc2626;color:#fff}
@media(max-width:720px){
  .kpi-grid,.period-grid{grid-template-columns:1fr 1fr}
  .row{flex-direction:column}
}
`;
