import "./Invoices.css";
// ─────────────────────────────────────────────────────────────────────────────
// Invoices.tsx — KhataGST Invoice Register
// Yahan user ke saare invoices dikhte hain — sales aur purchases dono
// Real data API se fetch hota hai — koi mock invoice nahi dikhega
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { getBusinessContext, getToken } from "../lib/session";
import CreateInvoiceForm from "./CreateInvoiceForm";

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
  itc_eligibility?: "eligible" | "blocked" | "rcm_applicable";
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
  itc_eligibility?: string;
}

// Props — parent se navigate function milta hai
interface Props {
  navigate: (route: Route) => void;
}

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
    itc_eligibility:
      raw.itc_eligibility === "blocked" || raw.itc_eligibility === "rcm_applicable"
        ? raw.itc_eligibility
        : "eligible",
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
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState<"cancel" | "duplicate" | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadInvoices = useCallback(() => {
    if (!canFetch || !business?.id) {
      setLoading(false);
      return Promise.resolve();
    }

    setLoading(true);
    return apiFetch(`/invoices?business_id=${business.id}&limit=100`)
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(getApiErrorMessage(payload, "Could not load invoices."));

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
  }, [canFetch, business?.id]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

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

  async function cancelInvoice(id: string) {
    if (!window.confirm("Is invoice ko cancel karna hai?")) return;
    setActionBusy("cancel");
    setActionMsg(null);
    try {
      const res = await apiFetch(`/invoices/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Cancel fail hua."));
      setSelected(null);
      await loadInvoices();
      setActionMsg("Invoice cancel ho gaya.");
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Cancel fail hua.");
    } finally {
      setActionBusy(null);
    }
  }

  async function duplicateInvoice(inv: Invoice) {
    const stamp = new Date();
    const suffix = `${stamp.getHours()}${String(stamp.getMinutes()).padStart(2, "0")}`;
    const newNumber = `${inv.invoice_number}-COPY-${suffix}`.slice(0, 50);
    setActionBusy("duplicate");
    setActionMsg(null);
    try {
      const res = await apiFetch(`/invoices/${inv.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({
          new_invoice_number: newNumber,
          new_invoice_date: new Date().toISOString().split("T")[0],
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Duplicate fail hua."));
      setSelected(null);
      await loadInvoices();
      setActionMsg(`Copy ban gaya: ${newNumber}`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Duplicate fail hua.");
    } finally {
      setActionBusy(null);
    }
  }

  if (selected) {
    const gstRows = [
      ["Taxable Amount", formatMoney(selected.taxable_amount)],
      ...(selected.cgst_amount > 0 ? [["CGST", formatMoney(selected.cgst_amount)]] : []),
      ...(selected.sgst_amount > 0 ? [["SGST", formatMoney(selected.sgst_amount)]] : []),
      ...(selected.igst_amount > 0 ? [["IGST", formatMoney(selected.igst_amount)]] : []),
    ];
    const itcLabel =
      selected.invoice_type !== "purchase"
        ? null
        : selected.itc_eligibility === "blocked"
          ? "ITC Blocked 17(5)"
          : selected.itc_eligibility === "rcm_applicable"
            ? "RCM"
            : "ITC Eligible";

    return (
      <>

        <header className="topbar">
          <button className="back-btn" onClick={() => setSelected(null)}>
            ← Back
          </button>
          <div className="topbar-brand">Invoice Detail</div>
          <div style={{ width: 80 }} />
        </header>

        <main className="page">
          {actionMsg && <div className="action-banner" role="status">{actionMsg}</div>}
          <div className="detail-card">
            <div className="detail-head">
              <div>
                <div className="detail-eyebrow">Invoice Number</div>
                <h1 className="detail-num">{selected.invoice_number}</h1>
              </div>
              <span className={`inv-badge ${
                selected.gst_status === "matched" ? "badge-ok" :
                selected.gst_status === "unmatched" ? "badge-bad" : "badge-warn"
              }`}>
                {selected.gst_status === "matched" ? "GST Matched" :
                 selected.gst_status === "unmatched" ? "Mismatch Found" : "Pending Review"}
              </span>
            </div>

            {[
              ["Party", selected.party_name],
              ...(selected.party_gstin ? [["GSTIN", selected.party_gstin]] : []),
              ["Date", formatDate(selected.invoice_date)],
              ["Type", selected.invoice_type === "sale" ? "Sales Invoice" : "Purchase Invoice"],
              ...(itcLabel ? [["ITC", itcLabel]] : []),
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}

            <div className="detail-divider" />
            {gstRows.map(([label, value]) => (
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value mono-val">{value}</span>
              </div>
            ))}

            <div className="detail-total">
              <span>Grand Total</span>
              <span className="total-val">{formatMoney(selected.total_amount)}</span>
            </div>

            <div className="detail-actions">
              <button
                className="btn-sec"
                disabled={actionBusy !== null}
                onClick={() => void duplicateInvoice(selected)}
              >
                {actionBusy === "duplicate" ? "Copying…" : "Duplicate"}
              </button>
              <button
                className="btn-danger"
                disabled={actionBusy !== null}
                onClick={() => void cancelInvoice(selected.id)}
              >
                {actionBusy === "cancel" ? "Cancelling…" : "Cancel invoice"}
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── Main Invoice List View ──────────────────────────────────────────────
  return (
    <>


      {/* ── Top Navigation ────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">Invoices</div>
        <button className="btn-pri" onClick={() => setCreating(true)}>
          + New
        </button>
      </header>

      <main className="page">
        <div className="workspace-title"><div><p className="workspace-kicker">RECORDS</p><h1>Invoice register</h1><p>Track sales, purchases and the details behind every transaction.</p></div></div>
        {actionMsg && <div className="action-banner">{actionMsg}</div>}

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
              aria-label="Search invoices"
              className="search-input"
              placeholder="Search by party, invoice no, or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Clear invoice search" className="search-clear" onClick={() => setSearch("")}>✕</button>
            )}
          </div>

          {/* Sort dropdown */}
          <select
            aria-label="Sort invoices"
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
              aria-pressed={tab === t}
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
            <button className="btn-pri" onClick={() => void loadInvoices()}>Retry loading invoices</button>
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
              {search ? "Try a different search term." : "Create a sales invoice or scan a purchase bill."}
            </p>
            {search && <button className="btn-sec" onClick={()=>setSearch("")}>Clear search</button>}
            {!search && (
              <button className="btn-pri" onClick={() => setCreating(true)}>
                Create Invoice
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
      {creating && (
        <CreateInvoiceForm
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void loadInvoices();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Clean consistent design, light background
// ─────────────────────────────────────────────────────────────────────────────
