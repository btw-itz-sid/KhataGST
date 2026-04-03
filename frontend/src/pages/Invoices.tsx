// ─────────────────────────────────────────────────────────────────────────────
// Invoices.tsx — KhataGST Invoice Register
// Yahan user ke saare invoices dikhte hain — sales aur purchases dono
// Real data API se fetch hota hai — koi mock invoice nahi dikhega
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

// Route type — navigate karne ke liye
type Route = "login" | "dashboard" | "scan" | "invoices";

// Filter tabs — sab, sirf sale, sirf purchase
type Tab = "all" | "sale" | "purchase";

// Sorting options
type SortKey = "date" | "amount" | "party";

// Ek invoice ka pura structure
interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: "sale" | "purchase";
  party_name: string;
  party_gstin?: string;
  taxable_amount: number;   // paise mein
  cgst_amount: number;      // paise mein
  sgst_amount: number;      // paise mein
  igst_amount: number;      // paise mein
  total_amount: number;     // paise mein
  gst_status: "matched" | "pending" | "unmatched";
}

// Raw invoice jaise API se aata hai (type-unsafe)
interface RawInvoice {
  id?: string;
  invoice_number?: string;
  invoice_date?: string;
  invoice_type?: string;
  party_name?: string;
  party_gstin?: string;
  taxable_value?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_amount?: number;
  gst_status?: string;
}

// Props — parent se navigate function milta hai
interface Props {
  navigate: (route: Route) => void;
}

// Backend ka base URL
const BASE_URL = "/api/v1";

// ── Helper: Paise ko INR format mein dikhao ────────────────────────────────
function formatMoney(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ── Helper: Date ko readable format mein convert karo ────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

// ── Helper: Raw API invoice ko normalized Invoice object mein convert karo ─
function normalizeInvoice(raw: RawInvoice): Invoice {
  return {
    id: String(raw.id ?? ""),
    invoice_number: String(raw.invoice_number ?? "NA"),
    invoice_date: String(raw.invoice_date ?? new Date().toISOString()),
    invoice_type: raw.invoice_type === "purchase" ? "purchase" : "sale",
    party_name: String(raw.party_name ?? raw.party_gstin ?? "Unknown Party"),
    party_gstin: raw.party_gstin ?? undefined,
    taxable_amount: Number(raw.taxable_value ?? raw.taxable_amount ?? 0),
    cgst_amount: Number(raw.cgst_amount ?? 0),
    sgst_amount: Number(raw.sgst_amount ?? 0),
    igst_amount: Number(raw.igst_amount ?? 0),
    total_amount: Number(raw.total_amount ?? 0),
    gst_status:
      raw.gst_status === "matched" || raw.gst_status === "unmatched"
        ? raw.gst_status
        : "pending",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Invoices Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Invoices({ navigate }: Props) {
  // Session se token aur business context nikalo
  const token = getToken();
  const business = getBusinessContext();
  const canFetch = Boolean(token && business?.id);

  // State management
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(canFetch);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [selected, setSelected] = useState<Invoice | null>(null);  // Detail view

  // ── API se invoices fetch karo ──────────────────────────────────────────
  useEffect(() => {
    // Agar session nahi hai toh fetch mat karo
    if (!canFetch || !business?.id) {
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/invoices?business_id=${business.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error("Could not load invoices.");

        // API response ke do formats support karo
        const rows: RawInvoice[] = Array.isArray(payload?.invoices ?? payload?.data)
          ? payload?.invoices ?? payload?.data
          : [];

        setInvoices(rows.map(normalizeInvoice));
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load invoices.");
      })
      .finally(() => setLoading(false));
  }, [canFetch, business?.id, token]);

  // ── Search, Filter, Sort logic ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = invoices;

    // Tab filter — sale ya purchase
    if (tab !== "all") {
      list = list.filter((inv) => inv.invoice_type === tab);
    }

    // Search filter — invoice no, party name, ya GSTIN
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.party_name.toLowerCase().includes(q) ||
          (inv.party_gstin || "").toLowerCase().includes(q)
      );
    }

    // Sort karo
    return [...list].sort((a, b) => {
      if (sortBy === "amount") return b.total_amount - a.total_amount;
      if (sortBy === "party") return a.party_name.localeCompare(b.party_name);
      // Default: date descending — latest pehle
      return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
    });
  }, [invoices, tab, search, sortBy]);

  // Summary numbers tab ke hisaab se calculate karo
  const salesTotal = invoices.filter((i) => i.invoice_type === "sale").reduce((s, i) => s + i.total_amount, 0);
  const purchTotal = invoices.filter((i) => i.invoice_type === "purchase").reduce((s, i) => s + i.total_amount, 0);

  // ── Invoice Detail View (jab user kisi invoice pe click kare) ─────────
  if (selected) {
    const gstRows = [
      ["Taxable Amount", formatMoney(selected.taxable_amount)],
      ...(selected.cgst_amount > 0 ? [["CGST", formatMoney(selected.cgst_amount)]] : []),
      ...(selected.sgst_amount > 0 ? [["SGST", formatMoney(selected.sgst_amount)]] : []),
      ...(selected.igst_amount > 0 ? [["IGST", formatMoney(selected.igst_amount)]] : []),
    ];

    return (
      <>
        <style>{STYLES}</style>
        <header className="topbar">
          <button className="back-btn" onClick={() => setSelected(null)}>
            ← Back
          </button>
          <div className="topbar-brand">Invoice Detail</div>
          <div style={{ width: 80 }} />
        </header>

        <main className="page">
          <div className="detail-card">
            {/* Invoice Header */}
            <div className="detail-head">
              <div>
                <div className="detail-eyebrow">Invoice Number</div>
                <div className="detail-num">{selected.invoice_number}</div>
              </div>
              <span className={`inv-badge ${
                selected.gst_status === "matched" ? "badge-ok" :
                selected.gst_status === "unmatched" ? "badge-bad" : "badge-warn"
              }`}>
                {selected.gst_status === "matched" ? "GST Matched" :
                 selected.gst_status === "unmatched" ? "Mismatch Found" : "Pending Review"}
              </span>
            </div>

            {/* Basic Info Rows */}
            {[
              ["Party", selected.party_name],
              ...(selected.party_gstin ? [["GSTIN", selected.party_gstin]] : []),
              ["Date", formatDate(selected.invoice_date)],
              ["Type", selected.invoice_type === "sale" ? "Sales Invoice" : "Purchase Invoice"],
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}

            {/* Tax Breakdown */}
            <div className="detail-divider" />
            {gstRows.map(([label, value]) => (
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value mono-val">{value}</span>
              </div>
            ))}

            {/* Grand Total */}
            <div className="detail-total">
              <span>Grand Total</span>
              <span className="total-val">{formatMoney(selected.total_amount)}</span>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Main Invoice List View ──────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      {/* ── Top Navigation ────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">Invoices</div>
        <button className="btn-pri" onClick={() => navigate("scan")}>
          + Scan
        </button>
      </header>

      <main className="page">

        {/* ── Summary Bar (sirf jab sab tab selected ho) ────────────────── */}
        {tab === "all" && invoices.length > 0 && (
          <div className="summary-bar">
            <div className="sum-item">
              <span className="sum-label">Sales ({invoices.filter(i => i.invoice_type === "sale").length})</span>
              <span className="sum-val sum-green">{formatMoney(salesTotal)}</span>
            </div>
            <div className="sum-divider" />
            <div className="sum-item sum-right">
              <span className="sum-label">Purchases ({invoices.filter(i => i.invoice_type === "purchase").length})</span>
              <span className="sum-val">{formatMoney(purchTotal)}</span>
            </div>
          </div>
        )}

        {/* ── Search Bar ─────────────────────────────────────────────────── */}
        <div className="search-row">
          <div className="search-wrap">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search by party, invoice no, or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          {/* Sort dropdown */}
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="date">Latest First</option>
            <option value="amount">By Amount</option>
            <option value="party">By Party</option>
          </select>
        </div>

        {/* ── Tab Filter ──────────────────────────────────────────────────── */}
        <div className="tab-row">
          {(["all", "sale", "purchase"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "tab-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "all" ? "All" : t === "sale" ? "Sales" : "Purchases"}
            </button>
          ))}
        </div>

        {/* ── Content: Loading / Error / Empty / List ──────────────────── */}
        {loading ? (
          // Data load ho raha hai
          <div className="center-state">
            <div className="load-spinner" />
            <span>Loading invoices…</span>
          </div>
        ) : error ? (
          // API fail ho gayi
          <div className="center-state">
            <div className="error-box">{error}</div>
            <button className="btn-pri" onClick={() => navigate("dashboard")}>Go to Dashboard</button>
          </div>
        ) : filtered.length === 0 ? (
          // Koi invoice nahi mila
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
              </svg>
            </div>
            <p className="empty-title">
              {search ? `No results for "${search}"` : "No invoices found"}
            </p>
            <p className="empty-sub">
              {search ? "Try a different search term." : "Scan your first invoice to get started."}
            </p>
            {!search && (
              <button className="btn-pri" onClick={() => navigate("scan")}>
                Scan Invoice
              </button>
            )}
          </div>
        ) : (
          // Invoice list
          <div className="inv-list">
            <div className="inv-count">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</div>

            {filtered.map((inv) => (
              <button
                key={inv.id}
                className="inv-card"
                onClick={() => setSelected(inv)}
              >
                {/* Type Badge */}
                <div className={`type-badge ${inv.invoice_type === "sale" ? "type-sale" : "type-pur"}`}>
                  {inv.invoice_type === "sale" ? "S" : "P"}
                </div>

                {/* Invoice Info */}
                <div className="inv-info">
                  <div className="inv-top">
                    <span className="inv-num">{inv.invoice_number}</span>
                    <span className={`inv-badge ${
                      inv.gst_status === "matched" ? "badge-ok" :
                      inv.gst_status === "unmatched" ? "badge-bad" : "badge-warn"
                    }`}>
                      {inv.gst_status === "matched" ? "Matched" :
                       inv.gst_status === "unmatched" ? "Mismatch" : "Pending"}
                    </span>
                  </div>
                  <div className="inv-party">{inv.party_name}</div>
                </div>

                {/* Amount + Date */}
                <div className="inv-right">
                  <span className={`inv-amount ${inv.invoice_type === "sale" ? "amount-sale" : ""}`}>
                    {formatMoney(inv.total_amount)}
                  </span>
                  <span className="inv-date">{formatDate(inv.invoice_date)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Clean consistent design, light background
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{background:#f9fafb;font-family:'Inter',sans-serif;color:#111827;-webkit-font-smoothing:antialiased}
button{font-family:inherit;cursor:pointer;border:none;outline:none}
input,select{font-family:inherit;outline:none}

/* ── Top Navigation ─────────────────────────────────────────────────────── */
.topbar{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;gap:16px;
  padding:0 20px;height:56px;
  background:#fff;border-bottom:1px solid #e5e7eb;
}
.topbar-brand{
  font-size:15px;font-weight:700;color:#111827;
  font-family:'JetBrains Mono',monospace;flex:1;text-align:center;
}
.back-btn{
  padding:7px 12px;border-radius:7px;
  background:#f9fafb;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;
  transition:all .15s;
}
.back-btn:hover{background:#f3f4f6}
.btn-pri{
  padding:8px 16px;border-radius:7px;
  background:#f97316;color:#fff;
  font-size:13px;font-weight:600;
  box-shadow:0 1px 3px rgba(249,115,22,.3);
  transition:all .15s;
}
.btn-pri:hover{background:#ea580c}

/* ── Main Page ─────────────────────────────────────────────────────────── */
.page{
  max-width:680px;margin:0 auto;
  padding:20px 16px 100px;
  display:flex;flex-direction:column;gap:14px;
}

/* ── Summary Bar ─────────────────────────────────────────────────────────── */
.summary-bar{
  display:flex;align-items:center;
  padding:14px 16px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
}
.sum-item{flex:1;display:flex;flex-direction:column;gap:3px}
.sum-right{align-items:flex-end}
.sum-label{font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
.sum-val{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:#111827}
.sum-green{color:#059669}
.sum-divider{width:1px;background:#e5e7eb;align-self:stretch;margin:0 16px}

/* ── Search Row ─────────────────────────────────────────────────────────── */
.search-row{display:flex;gap:10px;align-items:center}
.search-wrap{
  flex:1;display:flex;align-items:center;gap:10px;
  background:#fff;border:1.5px solid #e5e7eb;border-radius:9px;
  padding:0 12px;transition:border-color .15s;
}
.search-wrap:focus-within{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.08)}
.search-icon{color:#9ca3af;flex-shrink:0}
.search-input{
  flex:1;border:none;background:transparent;
  padding:11px 0;font-size:14px;color:#111827;font-weight:500;
}
.search-input::placeholder{color:#9ca3af;font-weight:400}
.search-clear{
  background:none;border:none;color:#9ca3af;
  font-size:14px;padding:4px;cursor:pointer;transition:color .15s;
}
.search-clear:hover{color:#374151}
.sort-select{
  padding:10px 12px;border-radius:9px;
  border:1.5px solid #e5e7eb;background:#fff;
  font-size:13px;font-weight:600;color:#374151;
  cursor:pointer;transition:border-color .15s;white-space:nowrap;
}
.sort-select:focus{border-color:#f97316}

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.tab-row{display:flex;gap:6px;padding:4px;border-radius:9px;background:#f3f4f6}
.tab-btn{
  flex:1;padding:8px 12px;border-radius:7px;
  background:transparent;border:none;
  font-size:13px;font-weight:600;color:#6b7280;
  cursor:pointer;transition:all .15s;
}
.tab-active{background:#fff;color:#111827;box-shadow:0 1px 3px rgba(0,0,0,.08)}

/* ── Invoice List ────────────────────────────────────────────────────────── */
.inv-list{display:flex;flex-direction:column;gap:6px}
.inv-count{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}

.inv-card{
  width:100%;display:flex;align-items:center;gap:12px;
  padding:14px 16px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
  cursor:pointer;text-align:left;color:#111827;
  transition:all .15s;
}
.inv-card:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.06);transform:translateY(-1px)}

/* Type badge — S ya P */
.type-badge{
  width:32px;height:32px;border-radius:7px;
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:800;flex-shrink:0;font-family:'JetBrains Mono',monospace;
}
.type-sale{background:#d1fae5;color:#065f46}
.type-pur{background:#dbeafe;color:#1e40af}

/* Invoice info */
.inv-info{flex:1;min-width:0}
.inv-top{display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap}
.inv-num{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#374151}
.inv-party{font-size:13px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Right side */
.inv-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
.inv-amount{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#111827}
.amount-sale{color:#059669}
.inv-date{font-size:11px;color:#9ca3af}

/* Status Badges */
.inv-badge{
  display:inline-flex;align-items:center;
  padding:3px 8px;border-radius:5px;font-size:11px;font-weight:700;
}
.badge-ok{background:#d1fae5;color:#065f46}
.badge-warn{background:#fef3c7;color:#92400e}
.badge-bad{background:#fee2e2;color:#991b1b}

/* ── States ──────────────────────────────────────────────────────────────── */
.center-state{
  display:flex;flex-direction:column;align-items:center;
  gap:12px;padding:60px 20px;text-align:center;color:#6b7280;
  font-size:14px;
}
.load-spinner{
  width:28px;height:28px;border-radius:50%;
  border:3px solid #e5e7eb;border-top-color:#f97316;
  animation:spin .7s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}
.error-box{
  padding:14px 18px;border-radius:9px;
  background:#fee2e2;border:1px solid #fca5a5;
  color:#991b1b;font-size:14px;font-weight:600;
  max-width:400px;text-align:center;
}
.empty-state{
  text-align:center;padding:40px 20px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.empty-icon{
  width:56px;height:56px;border-radius:12px;
  background:#f3f4f6;display:flex;align-items:center;
  justify-content:center;color:#9ca3af;margin-bottom:4px;
}
.empty-title{font-size:16px;font-weight:700;color:#111827}
.empty-sub{font-size:14px;color:#6b7280}

/* ── Invoice Detail View ─────────────────────────────────────────────────── */
.detail-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:24px;display:flex;flex-direction:column;gap:0;
}
.detail-head{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:16px;margin-bottom:20px;
}
.detail-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:#9ca3af;margin-bottom:5px;
}
.detail-num{
  font-family:'JetBrains Mono',monospace;
  font-size:20px;font-weight:700;color:#111827;
}
.detail-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:11px 0;border-bottom:1px solid #f3f4f6;
}
.detail-label{font-size:13px;color:#6b7280;font-weight:500}
.detail-value{font-size:14px;font-weight:600;color:#111827}
.mono-val{font-family:'JetBrains Mono',monospace}
.detail-divider{height:1px;background:#e5e7eb;margin:8px 0}
.detail-total{
  display:flex;justify-content:space-between;align-items:center;
  padding:14px 0 0;margin-top:4px;
}
.detail-total span{font-size:15px;font-weight:700;color:#111827}
.total-val{
  font-family:'JetBrains Mono',monospace;
  font-size:20px;font-weight:800;color:#f97316;
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:640px){
  .page{padding:16px 12px 90px}
  .topbar{padding:0 12px}
  .search-row{flex-direction:column;align-items:stretch}
  .sort-select{width:100%}
  .summary-bar{flex-direction:column;gap:12px}
  .sum-divider{width:100%;height:1px;margin:0}
  .sum-right{align-items:flex-start}
}
`;
