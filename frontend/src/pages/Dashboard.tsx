// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.tsx — KhataGST ka main screen
// Yahan sab kuch dikhta hai: sales, purchases, ITC, deadlines, aur invoices
// Sab data real API se aata hai — koi bhi mock data nahi
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

// Route type — app ke andar navigate karne ke liye
type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";

// GST matching status ke 3 types
type GstStatus = "matched" | "pending" | "unmatched";

// Dashboard mein dikhne waala data ka structure
interface DashboardData {
  totalSales: number;       // is mahine ki total sales (paise mein)
  totalPurchases: number;   // is mahine ki total purchases (paise mein)
  itcAvailable: number;     // Input Tax Credit jo milega (paise mein)
  taxPayable: number;       // jo GST bharna hai ITC ke baad (paise mein)
  gstr1DueDate: string;     // GSTR-1 ki due date
  gstr3bDueDate: string;    // GSTR-3B ki due date
  recentInvoices: RecentInvoice[];  // last 5 invoices
  totalInvoices: number;    // total kitne invoices hain
}

// Ek invoice ka data structure dashboard ke liye
interface RecentInvoice {
  id: string;
  invoice_number: string;
  party_name: string;
  total_amount: number;       // paise mein
  invoice_date: string;
  invoice_type: "sale" | "purchase";
  gst_status: GstStatus;
}

// Raw invoice jaise API se aata hai (type-safe nahi hota)
interface RawInvoice {
  id?: string;
  invoice_number?: string;
  party_name?: string;
  party_gstin?: string;
  total_amount?: number;
  invoice_date?: string;
  invoice_type?: string;
  gst_status?: string;
  taxable_value?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
}

// Returns ka data (due date nikalne ke liye)
interface ReturnSummary {
  return_type?: string;
  due_date?: string;
}

// Component ke props — parent se navigate aur logout milte hain
interface Props {
  navigate: (route: Route) => void;
  onLogout: () => void;
}

import { BASE_URL } from "../lib/api";

// ── Helper: Paise ko readable rupees mein convert karo ─────────────────────
function formatRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ── Helper: Date ko readable format mein convert karo ──────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Helper: Aaj se kitne din bacha hai due date mein ──────────────────────
function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Helper: Raw API invoice ko normalized format mein convert karo ─────────
function normalizeInvoice(invoice: RawInvoice): RecentInvoice {
  return {
    id: String(invoice.id ?? ""),
    invoice_number: String(invoice.invoice_number ?? "NA"),
    party_name: String(invoice.party_name ?? invoice.party_gstin ?? "Unknown Party"),
    total_amount: Number(invoice.total_amount ?? 0),
    invoice_date: String(invoice.invoice_date ?? new Date().toISOString()),
    invoice_type: invoice.invoice_type === "purchase" ? "purchase" : "sale",
    gst_status:
      invoice.gst_status === "matched" || invoice.gst_status === "unmatched"
        ? invoice.gst_status
        : "pending",
  };
}

// ── Helper: Due date ka tone determine karo (safe/warning/overdue) ─────────
function getDeadlineTone(dateStr: string): { tone: string; label: string; urgent: boolean } {
  if (!dateStr) return { tone: "safe", label: "—", urgent: false };
  const days = daysUntil(dateStr);
  if (days < 0) return { tone: "overdue", label: `${Math.abs(days)}d overdue`, urgent: true };
  if (days <= 5) return { tone: "warning", label: days === 0 ? "Due today!" : `${days}d left`, urgent: true };
  return { tone: "safe", label: `${days}d left`, urgent: false };
}

// ── GST Health Score calculate karo ────────────────────────────────────────
// Returns: score (0-100), label, color
function calcHealthScore(data: DashboardData): { score: number; label: string; color: string } {
  let score = 100;
  const days1 = daysUntil(data.gstr1DueDate);
  const days3b = daysUntil(data.gstr3bDueDate);

  // GSTR-1 deadline ke according score ghata
  if (days1 < 0) score -= 30;
  else if (days1 <= 3) score -= 15;
  else if (days1 <= 7) score -= 5;

  // GSTR-3B deadline ke according score ghata
  if (days3b < 0) score -= 30;
  else if (days3b <= 3) score -= 15;
  else if (days3b <= 7) score -= 5;

  // Tax liability zyada hai toh score ghata
  if (data.taxPayable > data.itcAvailable * 2) score -= 10;

  // Unmatched invoices hain toh score ghata
  if (data.recentInvoices.some((i) => i.gst_status === "unmatched")) score -= 10;

  // 0-100 ke beech rakho
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, label: "Compliant", color: "#10b981" };
  if (score >= 60) return { score, label: "Review Needed", color: "#f59e0b" };
  return { score, label: "At Risk", color: "#ef4444" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({ navigate, onLogout }: Props) {
  // State: data load ho raha hai ya nahi
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Business ka naam session se lo
  const [businessName, setBusinessName] = useState(
    getBusinessContext()?.name || "Your Business"
  );

  // Current period labels
  const currentMonth = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  // ── API se dashboard data fetch karo ──────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const business = getBusinessContext();
    const businessId = business?.id ?? "";

    // Agar token ya business nahi hai toh error dikhao
    if (!token || !businessId) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    // Sab APIs ek saath call karo (faster loading)
    async function fetchDashboard() {
      try {
        const [businessRes, invoiceRes, returnsRes] = await Promise.all([
          fetch(`${BASE_URL}/businesses/${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/invoices?business_id=${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/returns?business_id=${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // Business info se naam update karo
        const businessPayload = await businessRes.json().catch(() => null);
        if (businessRes.ok) {
          const liveName =
            businessPayload?.business?.legal_name ??
            businessPayload?.business?.trade_name ??
            business?.name ?? "";
          if (liveName) setBusinessName(liveName);
        }

        // Invoice data parse karo
        if (!invoiceRes.ok) throw new Error("Invoice data could not be loaded.");
        const invoicePayload = await invoiceRes.json().catch(() => null);
        const rawInvoices: RawInvoice[] = Array.isArray(
          invoicePayload?.invoices ?? invoicePayload?.data
        )
          ? invoicePayload?.invoices ?? invoicePayload?.data
          : [];

        const invoices = rawInvoices.map(normalizeInvoice);

        // Returns data parse karo (due dates ke liye)
        const returnsPayload = await returnsRes.json().catch(() => null);
        const returns: ReturnSummary[] = Array.isArray(
          returnsPayload?.returns ?? returnsPayload?.data
        )
          ? returnsPayload?.returns ?? returnsPayload?.data
          : [];

        // Totals calculate karo
        let totalSales = 0, totalPurchases = 0, itcAvailable = 0, taxPayable = 0;
        for (const inv of rawInvoices) {
          const taxable = Number(inv.taxable_value ?? 0);
          const tax = Number(inv.cgst_amount ?? 0) + Number(inv.sgst_amount ?? 0) + Number(inv.igst_amount ?? 0);
          if (inv.invoice_type === "sale") {
            totalSales += taxable;
            taxPayable += tax;
          } else {
            totalPurchases += taxable;
            itcAvailable += tax;
          }
        }

        // Due dates dhundo
        const gstr1 = returns.find((r) => r.return_type === "GSTR1");
        const gstr3b = returns.find((r) => r.return_type === "GSTR3B");

        // Due date calculate karo agar API se nahi aaya
        const now = new Date();
        const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const dd11 = new Date(nextM.getFullYear(), nextM.getMonth(), 11).toISOString().split("T")[0];
        const dd20 = new Date(nextM.getFullYear(), nextM.getMonth(), 20).toISOString().split("T")[0];

        setData({
          totalSales,
          totalPurchases,
          itcAvailable,
          taxPayable: Math.max(0, taxPayable - itcAvailable),
          gstr1DueDate: gstr1?.due_date || dd11,
          gstr3bDueDate: gstr3b?.due_date || dd20,
          recentInvoices: invoices.slice(0, 5),
          totalInvoices: invoices.length,
        });
        setError(null);
      } catch (err) {
        // API fail ho toh user ko batao
        setError(err instanceof Error ? err.message : "Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="load-screen">
          <div className="load-logo">Khata<span>GST</span></div>
          <div className="load-spinner" />
          <span className="load-text">Loading your workspace…</span>
        </div>
      </>
    );
  }

  // ── Error state — session issue ya API down ────────────────────────────────
  if (error && !data) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="load-screen">
          <div className="load-logo">Khata<span>GST</span></div>
          <p className="err-msg">{error}</p>
          <button className="btn-pri" onClick={onLogout}>Return to Login</button>
        </div>
      </>
    );
  }

  // Dashboard data ready hai, render karo
  const d = data!;
  const health = calcHealthScore(d);
  const g1 = getDeadlineTone(d.gstr1DueDate);
  const g3b = getDeadlineTone(d.gstr3bDueDate);

  return (
    <>
      <style>{STYLES}</style>

      {/* ── Top Navigation Bar ──────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          Khata<span>GST</span>
        </div>
        {/* Business naam aur current period chips */}
        <div className="topbar-center">
          <span className="chip">{businessName}</span>
          <span className="chip chip-muted">{currentMonth}</span>
        </div>
        <button className="btn-ghost" onClick={onLogout}>
          Logout
        </button>
      </header>

      {/* ── Main Page Content ────────────────────────────────────────────── */}
      <main className="page">

        {/* ── Hero Strip: Business naam + quick stats ──────────────────── */}
        <section className="hero-strip">
          <div className="hero-left">
            <div className="hero-eyebrow">Dashboard</div>
            <h1 className="hero-title">{businessName}</h1>
            <p className="hero-sub">
              {d.totalInvoices === 0
                ? "Add your first invoice to get started."
                : `${d.totalInvoices} invoice${d.totalInvoices !== 1 ? "s" : ""} tracked this period.`}
            </p>
            <div className="hero-btns">
              <button className="btn-pri" onClick={() => navigate("scan")}>
                + Scan Invoice
              </button>
              <button className="btn-out" onClick={() => navigate("invoices")}>
                View All Invoices
              </button>
            </div>
          </div>
          {/* GST Health Score ring */}
          <div className="hero-right">
            <div className="health-card">
              <div className="health-label">GST Health</div>
              <div className="health-score" style={{ color: health.color }}>
                {health.score}
              </div>
              <div className="health-badge" style={{ color: health.color }}>
                {health.label}
              </div>
              <div className="health-checks">
                <div className="hcheck">
                  <span className={g1.tone === "safe" ? "dot-ok" : "dot-warn"} />
                  GSTR-1: {g1.label}
                </div>
                <div className="hcheck">
                  <span className={g3b.tone === "safe" ? "dot-ok" : "dot-warn"} />
                  GSTR-3B: {g3b.label}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4 Metric Cards ───────────────────────────────────────────── */}
        <section className="stat-grid">
          {/* Total Sales */}
          <div className="stat-card">
            <div className="stat-icon stat-icon-green">↑</div>
            <div className="stat-label">Total Sales</div>
            <div className="stat-value stat-green">{formatRupees(d.totalSales)}</div>
            <div className="stat-sub">Taxable outward supply</div>
          </div>

          {/* Total Purchases */}
          <div className="stat-card">
            <div className="stat-icon stat-icon-blue">↓</div>
            <div className="stat-label">Total Purchases</div>
            <div className="stat-value stat-blue">{formatRupees(d.totalPurchases)}</div>
            <div className="stat-sub">Taxable inward supply</div>
          </div>

          {/* ITC Available */}
          <div className="stat-card">
            <div className="stat-icon stat-icon-violet">◈</div>
            <div className="stat-label">ITC Available</div>
            <div className="stat-value stat-violet">{formatRupees(d.itcAvailable)}</div>
            <div className="stat-sub">Input tax credit</div>
          </div>

          {/* Net GST Payable */}
          <div className="stat-card">
            <div className={`stat-icon ${d.taxPayable > 0 ? "stat-icon-amber" : "stat-icon-green"}`}>₹</div>
            <div className="stat-label">Net GST Payable</div>
            <div className={`stat-value ${d.taxPayable > 0 ? "stat-amber" : "stat-green"}`}>
              {d.taxPayable > 0 ? formatRupees(d.taxPayable) : "Nil"}
            </div>
            <div className="stat-sub">
              {d.taxPayable > 0 ? "After ITC offset" : "ITC covers liability"}
            </div>
          </div>
        </section>

        {/* ── Deadline Cards + Quick Actions ───────────────────────────── */}
        <section className="mid-grid">
          {/* GSTR-1 Deadline */}
          <div className={`deadline-card ${g1.urgent ? "deadline-urgent" : ""}`}>
            <div className="deadline-code">GSTR-1</div>
            <div className="deadline-name">Sales Return</div>
            <div className="deadline-date">{formatDate(d.gstr1DueDate)}</div>
            <span className={`deadline-pill ${g1.tone}`}>{g1.label}</span>
            <p className="deadline-desc">
              File all outward B2B/B2C supply details before this date.
            </p>
            <button className="deadline-btn" onClick={() => navigate("export")}>
              Prepare Export
            </button>
          </div>

          {/* GSTR-3B Deadline */}
          <div className={`deadline-card ${g3b.urgent ? "deadline-urgent" : ""}`}>
            <div className="deadline-code">GSTR-3B</div>
            <div className="deadline-name">Tax Payment</div>
            <div className="deadline-date">{formatDate(d.gstr3bDueDate)}</div>
            <span className={`deadline-pill ${g3b.tone}`}>{g3b.label}</span>
            <p className="deadline-desc">
              Pay your net GST liability after adjusting ITC.
            </p>
            <button className="deadline-btn" onClick={() => navigate("export")}>
              View Summary
            </button>
          </div>

          {/* Quick Actions Panel */}
          <div className="actions-panel">
            <div className="panel-title">Quick Actions</div>
            <button className="action-row" onClick={() => navigate("scan")}>
              <div className="action-icon action-orange">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7"/><path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7"/>
                  <path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17"/>
                  <path d="M12 8v8"/><path d="M8 12h8"/>
                </svg>
              </div>
              <div className="action-text">
                <strong>Scan Invoice</strong>
                <span>AI-powered bill extraction</span>
              </div>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-row" onClick={() => navigate("invoices")}>
              <div className="action-icon action-blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
                  <path d="M14 3.5V8h4"/><path d="M9 12h6"/><path d="M9 16h6"/>
                </svg>
              </div>
              <div className="action-text">
                <strong>Invoice Register</strong>
                <span>View and manage all invoices</span>
              </div>
              <span className="action-arrow">›</span>
            </button>
            <button className="action-row" onClick={() => navigate("export")}>
              <div className="action-icon action-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4v10"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
                  <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
                </svg>
              </div>
              <div className="action-text">
                <strong>Export Package</strong>
                <span>Download GSTR Excel or CSV</span>
              </div>
              <span className="action-arrow">›</span>
            </button>
          </div>
        </section>

        {/* ── Recent Invoices Table ─────────────────────────────────────── */}
        <section className="invoices-panel">
          <div className="panel-header">
            <div className="panel-title">Recent Invoices</div>
            <button className="link-btn" onClick={() => navigate("invoices")}>
              View all →
            </button>
          </div>

          {/* Agar koi invoice nahi hai toh empty state dikhao */}
          {d.recentInvoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
                  <path d="M14 3.5V8h4"/><path d="M9 12h6"/><path d="M9 16h6"/>
                </svg>
              </div>
              <p className="empty-title">No invoices yet</p>
              <p className="empty-sub">Scan your first GST invoice to activate tracking.</p>
              <button className="btn-pri" onClick={() => navigate("scan")}>
                Scan First Invoice
              </button>
            </div>
          ) : (
            <div className="inv-table">
              {/* Table Header */}
              <div className="inv-row inv-header">
                <span>Invoice No.</span>
                <span>Party</span>
                <span>Date</span>
                <span>Type</span>
                <span>Status</span>
                <span className="text-right">Amount</span>
              </div>
              {/* Invoice rows */}
              {d.recentInvoices.map((inv) => (
                <button
                  key={inv.id}
                  className="inv-row inv-data-row"
                  onClick={() => navigate("invoices")}
                >
                  <span className="inv-num">{inv.invoice_number}</span>
                  <span className="inv-party">{inv.party_name}</span>
                  <span className="inv-date">{formatDate(inv.invoice_date)}</span>
                  <span className={`inv-badge ${inv.invoice_type === "sale" ? "badge-sale" : "badge-pur"}`}>
                    {inv.invoice_type === "sale" ? "Sale" : "Purchase"}
                  </span>
                  <span className={`inv-badge ${
                    inv.gst_status === "matched" ? "badge-ok" :
                    inv.gst_status === "unmatched" ? "badge-bad" : "badge-warn"
                  }`}>
                    {inv.gst_status === "matched" ? "Matched" :
                     inv.gst_status === "unmatched" ? "Mismatch" : "Pending"}
                  </span>
                  <span className="inv-amount">{formatRupees(inv.total_amount)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Clean SaaS design, no glassmorphism overdose
// Light background, subtle shadows, orange brand color
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

/* ── Reset & Base ──────────────────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:#f9fafb;
  font-family:'Inter',sans-serif;
  color:#111827;
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
}
button{font-family:inherit;cursor:pointer;border:none;outline:none}

/* ── Loading screen ────────────────────────────────────────────────────── */
.load-screen{
  min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;background:#f9fafb;
}
.load-logo{
  font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:#111827;
}
.load-logo span{color:#f97316}
.load-spinner{
  width:32px;height:32px;border-radius:50%;
  border:3px solid #e5e7eb;border-top-color:#f97316;
  animation:spin .7s linear infinite;
}
.load-text{font-size:14px;color:#6b7280}
.err-msg{font-size:15px;color:#dc2626;text-align:center;max-width:320px}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Top Navigation Bar ────────────────────────────────────────────────── */
.topbar{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;gap:16px;
  padding:0 24px;height:56px;
  background:#fff;border-bottom:1px solid #e5e7eb;
}
.topbar-brand{
  font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#111827;
  margin-right:auto;
}
.topbar-brand span{color:#f97316}
.topbar-center{display:flex;gap:8px;align-items:center}
.chip{
  display:inline-flex;align-items:center;
  padding:5px 12px;border-radius:6px;
  border:1px solid #e5e7eb;background:#fff;
  font-size:12px;font-weight:600;color:#374151;
}
.chip-muted{color:#9ca3af;border-color:#f3f4f6;background:#f9fafb}
.btn-ghost{
  padding:7px 14px;border-radius:6px;
  background:transparent;font-size:13px;font-weight:600;
  color:#6b7280;border:1px solid #e5e7eb;
  transition:all .15s;
}
.btn-ghost:hover{background:#f3f4f6;color:#374151}

/* ── Main Page ─────────────────────────────────────────────────────────── */
.page{
  max-width:1100px;margin:0 auto;
  padding:28px 24px 120px;
  display:flex;flex-direction:column;gap:20px;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.btn-pri{
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 18px;border-radius:8px;
  background:#f97316;color:#fff;
  font-size:14px;font-weight:600;
  box-shadow:0 1px 3px rgba(249,115,22,.3);
  transition:all .15s;
}
.btn-pri:hover{background:#ea580c;box-shadow:0 4px 12px rgba(249,115,22,.35);transform:translateY(-1px)}
.btn-out{
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 18px;border-radius:8px;
  background:#fff;color:#374151;
  font-size:14px;font-weight:600;
  border:1px solid #d1d5db;
  transition:all .15s;
}
.btn-out:hover{background:#f9fafb;transform:translateY(-1px)}
.link-btn{
  background:none;border:none;padding:0;
  font-size:13px;font-weight:600;color:#f97316;
  cursor:pointer;transition:color .15s;
}
.link-btn:hover{color:#ea580c}

/* ── Hero Strip ─────────────────────────────────────────────────────────── */
.hero-strip{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:24px;padding:28px;border-radius:12px;
  background:#fff;border:1px solid #e5e7eb;
}
.hero-left{flex:1}
.hero-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:#9ca3af;margin-bottom:8px;
}
.hero-title{
  font-size:clamp(22px,3vw,30px);font-weight:800;
  letter-spacing:-.02em;color:#111827;line-height:1.2;margin-bottom:6px;
}
.hero-sub{font-size:14px;color:#6b7280;margin-bottom:18px;line-height:1.5}
.hero-btns{display:flex;gap:10px;flex-wrap:wrap}
.hero-right{flex-shrink:0}

/* GST Health Card */
.health-card{
  padding:20px 24px;border-radius:10px;
  background:#f9fafb;border:1px solid #e5e7eb;
  text-align:center;min-width:160px;
}
.health-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px}
.health-score{font-size:40px;font-weight:800;font-family:'JetBrains Mono',monospace;line-height:1}
.health-badge{font-size:12px;font-weight:700;margin-top:4px}
.health-checks{margin-top:12px;display:flex;flex-direction:column;gap:6px;text-align:left}
.hcheck{display:flex;align-items:center;gap:7px;font-size:12px;color:#6b7280}
.dot-ok{width:7px;height:7px;border-radius:50%;background:#10b981;flex-shrink:0}
.dot-warn{width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0}

/* ── Stat Cards Grid ────────────────────────────────────────────────────── */
.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.stat-card{
  padding:20px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
  transition:box-shadow .2s,transform .2s;
}
.stat-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.stat-icon{
  width:34px;height:34px;border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  font-size:16px;font-weight:700;margin-bottom:12px;
}
.stat-icon-green{background:#d1fae5;color:#065f46}
.stat-icon-blue{background:#dbeafe;color:#1e40af}
.stat-icon-violet{background:#ede9fe;color:#4c1d95}
.stat-icon-amber{background:#fef3c7;color:#92400e}
.stat-label{font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
.stat-value{
  font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;
  letter-spacing:-.02em;margin-bottom:4px;line-height:1.1;
}
.stat-green{color:#059669}
.stat-blue{color:#2563eb}
.stat-violet{color:#7c3aed}
.stat-amber{color:#d97706}
.stat-sub{font-size:12px;color:#9ca3af}

/* ── Mid Grid (deadlines + actions) ──────────────────────────────────────── */
.mid-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}

/* Deadline Card */
.deadline-card{
  padding:20px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
  display:flex;flex-direction:column;gap:8px;
  transition:box-shadow .2s;
}
.deadline-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06)}
.deadline-urgent{border-color:#fca5a5;background:#fff7f7}
.deadline-code{
  font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:700;letter-spacing:.08em;color:#9ca3af;
}
.deadline-name{font-size:16px;font-weight:700;color:#111827}
.deadline-date{font-size:13px;font-weight:600;color:#374151}
.deadline-desc{font-size:12px;color:#6b7280;line-height:1.55;flex:1}
.deadline-pill{
  display:inline-flex;align-items:center;
  padding:3px 9px;border-radius:99px;
  font-size:11px;font-weight:700;
}
.safe{background:#d1fae5;color:#065f46}
.warning{background:#fef3c7;color:#92400e}
.overdue{background:#fee2e2;color:#991b1b}
.deadline-btn{
  width:100%;padding:9px;border-radius:7px;
  border:1px solid #e5e7eb;background:#f9fafb;
  font-size:13px;font-weight:600;color:#374151;
  transition:all .15s;margin-top:2px;
}
.deadline-btn:hover{background:#f3f4f6;border-color:#d1d5db}

/* Actions Panel */
.actions-panel{
  padding:20px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
}
.panel-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:12px}
.panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.action-row{
  width:100%;display:flex;align-items:center;gap:12px;
  padding:12px;border-radius:8px;background:transparent;
  border:1px solid transparent;text-align:left;
  transition:all .15s;margin-bottom:6px;color:#111827;
}
.action-row:last-child{margin-bottom:0}
.action-row:hover{background:#f9fafb;border-color:#e5e7eb}
.action-icon{
  width:34px;height:34px;border-radius:8px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
}
.action-orange{background:#fef3c7;color:#ea580c}
.action-blue{background:#dbeafe;color:#1d4ed8}
.action-green{background:#d1fae5;color:#059669}
.action-text{flex:1}
.action-text strong{display:block;font-size:13px;font-weight:700;color:#111827;margin-bottom:1px}
.action-text span{font-size:12px;color:#6b7280}
.action-arrow{font-size:18px;color:#d1d5db;font-weight:300}

/* ── Invoices Panel ──────────────────────────────────────────────────────── */
.invoices-panel{
  padding:20px;border-radius:10px;
  background:#fff;border:1px solid #e5e7eb;
}
.inv-table{display:flex;flex-direction:column}
.inv-row{
  display:grid;
  grid-template-columns:120px 1fr 100px 80px 85px 100px;
  gap:12px;align-items:center;padding:11px 14px;
  font-size:13px;
}
.inv-header{
  color:#6b7280;font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;
  border-bottom:1px solid #e5e7eb;padding-bottom:10px;margin-bottom:4px;
}
.inv-data-row{
  width:100%;text-align:left;background:transparent;border:none;
  border-radius:7px;cursor:pointer;color:#111827;
  transition:background .12s;
}
.inv-data-row:hover{background:#f9fafb}
.inv-num{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#374151}
.inv-party{font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inv-date{font-size:12px;color:#6b7280}
.inv-amount{font-family:'JetBrains Mono',monospace;font-weight:700;color:#111827;text-align:right}
.text-right{text-align:right}

/* Badges */
.inv-badge{
  display:inline-flex;align-items:center;
  padding:3px 8px;border-radius:5px;
  font-size:11px;font-weight:700;
}
.badge-sale{background:#d1fae5;color:#065f46}
.badge-pur{background:#dbeafe;color:#1e40af}
.badge-ok{background:#d1fae5;color:#065f46}
.badge-warn{background:#fef3c7;color:#92400e}
.badge-bad{background:#fee2e2;color:#991b1b}

/* ── Empty State ─────────────────────────────────────────────────────────── */
.empty-state{
  text-align:center;padding:40px 20px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.empty-icon{
  width:60px;height:60px;border-radius:12px;background:#f3f4f6;
  display:flex;align-items:center;justify-content:center;color:#9ca3af;margin-bottom:4px;
}
.empty-title{font-size:16px;font-weight:700;color:#111827}
.empty-sub{font-size:14px;color:#6b7280;margin-bottom:4px}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:1080px){
  .stat-grid{grid-template-columns:repeat(2,1fr)}
  .mid-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:720px){
  .page{padding:20px 16px 110px}
  .topbar{padding:0 16px}
  .topbar-center{display:none}
  .hero-strip{flex-direction:column;gap:16px}
  .hero-right{align-self:stretch}
  .health-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;text-align:left}
  .stat-grid{grid-template-columns:repeat(2,1fr)}
  .mid-grid{grid-template-columns:1fr}
  .inv-row{grid-template-columns:1fr auto;gap:8px}
  .inv-header{display:none}
  .inv-data-row{grid-template-columns:1fr auto}
  .inv-party,.inv-date,.inv-badge.badge-ok,.inv-badge.badge-warn,.inv-badge.badge-bad,.inv-badge.badge-sale,.inv-badge.badge-pur{display:none}
}
`;
