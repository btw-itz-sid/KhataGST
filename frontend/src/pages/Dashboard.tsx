// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.tsx — KhataGST ka main screen
// Yahan sab kuch dikhta hai: sales, purchases, ITC, deadlines, aur invoices
// Sab data real API se aata hai — koi bhi mock data nahi
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import "./Dashboard.css";
import { getBusinessContext, getToken } from "../lib/session";

// Route type — app ke andar navigate karne ke liye
type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing" | "reconcile";

// GST matching status ke 3 types
type GstStatus = "matched" | "pending" | "unmatched";

// Dashboard mein dikhne waala data ka structure
interface DashboardData {
  totalSales: number;       // is mahine ki total sales (paise mein)
  totalPurchases: number;   // is mahine ki total purchases (paise mein)
  itcAvailable: number;     // Eligible ITC jo claim kar sakte ho (paise)
  itcBlocked: number;       // Section 17(5) blocked ITC (paise)
  taxPayable: number;       // jo GST bharna hai eligible ITC ke baad (paise)
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
  itc_eligibility?: string;
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

import { apiFetch } from "../lib/api";

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
// Returns: score (0-100) and label
function calcHealthScore(data: DashboardData): { score: number; label: string } {
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

  if (data.taxPayable > data.itcAvailable * 2) score -= 10;
  if (data.itcBlocked > 0) score -= 5;
  if (data.recentInvoices.some((i) => i.gst_status === "unmatched")) score -= 10;

  // 0-100 ke beech rakho
  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, label: "Compliant" };
  if (score >= 60) return { score, label: "Review Needed" };
  return { score, label: "At Risk" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────
interface ComplianceNudge {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  action?: string;
}

function MetricIcon({ kind }: { kind: "credit" | "blocked" | "tax" | "purchases" }) {
  const paths = {
    credit: "M4 5h16v14H4z M4 9h16 M8 14h3 M15 14h2",
    blocked: "M12 8v5 M12 16h.01 M10.3 3.9 2.4 18a1.3 1.3 0 0 0 1.1 2h17a1.3 1.3 0 0 0 1.1-2L13.7 3.9a2 2 0 0 0-3.4 0Z",
    tax: "M7 4h10 M7 8h10 M9 4c5 0 5 7 0 7H7l8 9",
    purchases: "M5 7h14l1 13H4L5 7Z M8 7V5a4 4 0 0 1 8 0v2",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg>;
}
export default function Dashboard({ navigate, onLogout }: Props) {
  // State: data load ho raha hai ya nahi
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nudges, setNudges] = useState<ComplianceNudge[]>([]);
  const [nudgePeriod, setNudgePeriod] = useState("");

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
        const [businessRes, invoiceRes, returnsRes, nudgeRes] = await Promise.all([
          apiFetch(`/businesses/${businessId}`),
          apiFetch(`/invoices?business_id=${businessId}&limit=100`),
          apiFetch(`/returns?business_id=${businessId}`),
          apiFetch(`/compliance/nudges?business_id=${businessId}`),
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

        let totalSales = 0, totalPurchases = 0, itcAvailable = 0, itcBlocked = 0, outwardTax = 0;
        for (const inv of rawInvoices) {
          const taxable = Number(inv.taxable_value ?? 0);
          const tax = Number(inv.cgst_amount ?? 0) + Number(inv.sgst_amount ?? 0) + Number(inv.igst_amount ?? 0);
          if (inv.invoice_type === "sale") {
            totalSales += taxable;
            outwardTax += tax;
          } else {
            totalPurchases += taxable;
            if (inv.itc_eligibility === "blocked") itcBlocked += tax;
            else if (inv.itc_eligibility !== "rcm_applicable") itcAvailable += tax;
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
          itcBlocked,
          taxPayable: Math.max(0, outwardTax - itcAvailable),
          gstr1DueDate: gstr1?.due_date || dd11,
          gstr3bDueDate: gstr3b?.due_date || dd20,
          recentInvoices: invoices.slice(0, 5),
          totalInvoices: Number(invoicePayload?.pagination?.total ?? invoices.length),
        });

        const nudgePayload = await nudgeRes.json().catch(() => null);
        if (nudgeRes.ok) {
          setNudgePeriod(String(nudgePayload?.tax_period || ""));
          setNudges(Array.isArray(nudgePayload?.nudges) ? nudgePayload.nudges : []);
        }
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
      <div className="dashboard">

        <div className="load-screen">
          <div className="load-logo">Khata<span>GST</span></div>
          <div className="load-spinner" />
          <span className="load-text">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  // ── Error state — session issue ya API down ────────────────────────────────
  if (error && !data) {
    return (
      <div className="dashboard">

        <div className="load-screen">
          <div className="load-logo">Khata<span>GST</span></div>
          <p className="err-msg">{error}</p>
          <button className="btn-pri" onClick={onLogout}>Return to Login</button>
        </div>
      </div>
    );
  }

  // Dashboard data ready hai, render karo
  const d = data!;
  const health = calcHealthScore(d);
  const g1 = getDeadlineTone(d.gstr1DueDate);
  const g3b = getDeadlineTone(d.gstr3bDueDate);

  return (
    <div className="dashboard">


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
              <button className="btn-pri" onClick={() => navigate("invoices")}>
                + Create Sale
              </button>
              <button className="btn-out" onClick={() => navigate("scan")}>
                Scan Purchase
              </button>
            </div>
          </div>
          <div className="hero-right">
            <div className="health-card">
              <div className="health-label">ITC this month</div>
              <div className="health-score">
                {formatRupees(d.itcAvailable)}
              </div>
              <div className="health-badge">
                {health.label} · {health.score}
              </div>
              <div className="health-checks">
                <div className="hcheck">
                  <span className={d.itcBlocked > 0 ? "dot-warn" : "dot-ok"} />
                  Blocked: {formatRupees(d.itcBlocked)}
                </div>
                <div className="hcheck">
                  <span className={g3b.tone === "safe" ? "dot-ok" : "dot-warn"} />
                  Payable: {d.taxPayable > 0 ? formatRupees(d.taxPayable) : "Nil"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon" aria-hidden="true"><MetricIcon kind="credit" /></div>
            <div className="stat-label">ITC Claimable</div>
            <div className="stat-value">{formatRupees(d.itcAvailable)}</div>
            <div className="stat-sub">Eligible purchases only</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" aria-hidden="true"><MetricIcon kind="blocked" /></div>
            <div className="stat-label">ITC Blocked</div>
            <div className="stat-value">{formatRupees(d.itcBlocked)}</div>
            <div className="stat-sub">Excluded under Section 17(5)</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" aria-hidden="true"><MetricIcon kind="tax" /></div>
            <div className="stat-label">Net GST Payable</div>
            <div className="stat-value">
              {d.taxPayable > 0 ? formatRupees(d.taxPayable) : "Nil"}
            </div>
            <div className="stat-sub">After eligible ITC</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" aria-hidden="true"><MetricIcon kind="purchases" /></div>
            <div className="stat-label">Purchases</div>
            <div className="stat-value">{formatRupees(d.totalPurchases)}</div>
            <div className="stat-sub">Sales {formatRupees(d.totalSales)}</div>
          </div>
        </section>

        {nudges.length > 0 && (
          <section className="nudge-panel">
            <div className="nudge-head">
              <div>
                <div className="nudge-kicker">Needs attention</div>
                <h2 className="nudge-title">Purchase review{nudgePeriod ? ` · ${nudgePeriod}` : ""}</h2>
              </div>
              <button className="nudge-link" onClick={() => navigate("reconcile")}>Open 2B</button>
            </div>
            <div className="nudge-list">
              {nudges.slice(0, 4).map((nudge) => (
                <button
                  key={nudge.id}
                  className={`nudge-card nudge-${nudge.severity}`}
                  onClick={() => {
                    if (nudge.action === "reconcile") navigate("reconcile");
                    else if (nudge.action === "export") navigate("export");
                    else if (nudge.action === "invoices") navigate("invoices");
                  }}
                >
                  <span className="nudge-severity">{nudge.severity === "critical" ? "Action required" : nudge.severity === "warn" ? "Review" : "Information"}</span>
                  <strong>{nudge.title}</strong>
                  <span>{nudge.detail}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Deadline Cards + Quick Actions ───────────────────────────── */}
        <section className="mid-grid">
          {/* GSTR-1 Deadline */}
          <div className={`deadline-card ${g1.urgent ? "deadline-urgent" : ""}`}>
            <div className="deadline-code">GSTR-1</div>
            <div className="deadline-name">Sales Return</div>
            <div className="deadline-date">{formatDate(d.gstr1DueDate)}</div>
            <span className={`deadline-pill ${g1.tone}`}>{g1.label}</span>
            <p className="deadline-desc">
              Preview outward B2B/B2C supplies and prepare a pack for your CA.
            </p>
            <button className="deadline-btn" onClick={() => navigate("export")}>
              Preview GSTR-1
            </button>
          </div>

          {/* GSTR-3B Deadline */}
          <div className={`deadline-card ${g3b.urgent ? "deadline-urgent" : ""}`}>
            <div className="deadline-code">GSTR-3B</div>
            <div className="deadline-name">Tax summary</div>
            <div className="deadline-date">{formatDate(d.gstr3bDueDate)}</div>
            <span className={`deadline-pill ${g3b.tone}`}>{g3b.label}</span>
            <p className="deadline-desc">
              See net GST after eligible ITC. Blocked 17(5) credit is excluded.
            </p>
            <button className="deadline-btn" onClick={() => navigate("export")}>
              Preview GSTR-3B
            </button>
          </div>

          {/* Quick Actions Panel */}
          <div className="actions-panel">
            <div className="panel-title">Quick Actions</div>
            <button className="action-row" onClick={() => navigate("scan")}>
              <div className="action-icon">
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
              <div className="action-icon">
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
              <div className="action-icon">
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
            <button className="action-row" onClick={() => navigate("reconcile")}>
              <div className="action-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/>
                  <path d="m14 15 2 2 4-4"/>
                </svg>
              </div>
              <div className="action-text">
                <strong>2B Reconcile</strong>
                <span>Compare purchases with GSTR-2B</span>
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
    </div>
  );
}
