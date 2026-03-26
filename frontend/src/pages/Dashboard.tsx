import { useEffect, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

type Route = "login" | "dashboard" | "scan" | "invoices" | "export";
type GstStatus = "matched" | "pending" | "unmatched";

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  itcAvailable: number;
  taxPayable: number;
  gstr1DueDate: string;
  gstr3bDueDate: string;
  recentInvoices: RecentInvoice[];
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  party_name: string;
  total_amount: number;
  invoice_date: string;
  invoice_type: "sale" | "purchase";
  gst_status: GstStatus;
}

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

interface ReturnSummary {
  return_type?: string;
  due_date?: string;
}

interface Props {
  navigate: (route: Route) => void;
  onLogout: () => void;
}

const BASE_URL = "/api/v1";

const MOCK_DATA: DashboardData = {
  totalSales: 1000000,
  totalPurchases: 500000,
  itcAvailable: 45000,
  taxPayable: 90000,
  gstr1DueDate: "2026-04-11",
  gstr3bDueDate: "2026-04-20",
  recentInvoices: [
    {
      id: "1",
      invoice_number: "INV-001",
      party_name: "Ramesh Traders",
      total_amount: 1180000,
      invoice_date: "2026-03-15",
      invoice_type: "sale",
      gst_status: "matched",
    },
    {
      id: "2",
      invoice_number: "PUR-001",
      party_name: "Suresh Wholesale",
      total_amount: 590000,
      invoice_date: "2026-03-18",
      invoice_type: "purchase",
      gst_status: "pending",
    },
  ],
};

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeInvoice(invoice: RawInvoice): RecentInvoice {
  return {
    id: String(invoice.id ?? ""),
    invoice_number: String(invoice.invoice_number ?? "NA"),
    party_name: String(invoice.party_name ?? invoice.party_gstin ?? "Unknown party"),
    total_amount: Number(invoice.total_amount ?? 0),
    invoice_date: String(invoice.invoice_date ?? new Date().toISOString()),
    invoice_type: invoice.invoice_type === "purchase" ? "purchase" : "sale",
    gst_status:
      invoice.gst_status === "matched" || invoice.gst_status === "unmatched"
        ? invoice.gst_status
        : "pending",
  };
}

function getDeadlineTone(dateStr: string) {
  const days = daysUntil(dateStr);
  if (days < 0) return { tone: "critical", label: `${Math.abs(days)}d overdue` };
  if (days <= 5) return { tone: "warning", label: days === 0 ? "Due today" : `${days}d left` };
  return { tone: "stable", label: `${days}d left` };
}

function getStatusTone(status: GstStatus) {
  if (status === "matched") return { label: "Matched", tone: "good" };
  if (status === "unmatched") return { label: "Unmatched", tone: "bad" };
  return { label: "Pending", tone: "warn" };
}

// GST Health Score calculator
function calcHealthScore(data: DashboardData): { score: number; label: string; color: string } {
  let score = 100;
  const days1 = daysUntil(data.gstr1DueDate);
  const days3b = daysUntil(data.gstr3bDueDate);
  if (days1 < 0) score -= 30;
  else if (days1 <= 3) score -= 15;
  else if (days1 <= 7) score -= 5;
  if (days3b < 0) score -= 30;
  else if (days3b <= 3) score -= 15;
  else if (days3b <= 7) score -= 5;
  if (data.taxPayable > data.itcAvailable * 2) score -= 10;
  if (data.recentInvoices.some(i => i.gst_status === "unmatched")) score -= 10;
  score = Math.max(0, Math.min(100, score));
  if (score >= 80) return { score, label: "Healthy", color: "#34d399" };
  if (score >= 60) return { score, label: "Needs Review", color: "#fbbf24" };
  return { score, label: "At Risk", color: "#ef4444" };
}

// Donut chart using SVG
function DonutChart({ sales, purchases, itc }: { sales: number; purchases: number; itc: number }) {
  const total = sales + purchases + itc || 1;
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;

  function getArc(value: number, offset: number) {
    const pct = value / total;
    return { dash: pct * circumference, offset: offset * circumference };
  }

  const salesArc = getArc(sales, 0);
  const purchasesArc = getArc(purchases, sales / total);
  const itcArc = getArc(itc, (sales + purchases) / total);

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="16" />
      {/* ITC - violet */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#a78bfa" strokeWidth="16"
        strokeDasharray={`${itcArc.dash} ${circumference - itcArc.dash}`}
        strokeDashoffset={circumference - itcArc.offset * circumference}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}
        transform={`rotate(-90 ${cx} ${cy})`} />
      {/* Purchases - blue */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#60a5fa" strokeWidth="16"
        strokeDasharray={`${purchasesArc.dash} ${circumference - purchasesArc.dash}`}
        strokeDashoffset={circumference - purchasesArc.offset * circumference}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}
        transform={`rotate(-90 ${cx} ${cy})`} />
      {/* Sales - green */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#34d399" strokeWidth="16"
        strokeDasharray={`${salesArc.dash} ${circumference - salesArc.dash}`}
        strokeDashoffset={0}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="'IBM Plex Mono',monospace">TOTAL</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="'IBM Plex Mono',monospace">
        {formatRupees(sales + purchases + itc)}
      </text>
    </svg>
  );
}

// Health score ring
function HealthRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;

  return (
    <div className="health-ring-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800" fontFamily="'IBM Plex Mono',monospace">{score}</text>
        <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="'IBM Plex Mono',monospace">/ 100</text>
      </svg>
      <div className="health-label" style={{ color }}>{label}</div>
    </div>
  );
}

function DeadlineCard({ code, title, detail, dueDate, delay }: {
  code: string; title: string; detail: string; dueDate: string; delay: string;
}) {
  const meta = getDeadlineTone(dueDate);
  const days = daysUntil(dueDate);
  const totalDays = 30;
  const progress = Math.max(0, Math.min(100, ((totalDays - days) / totalDays) * 100));

  return (
    <article className={`deadline ${meta.tone} anim-slide`} style={{ animationDelay: delay }}>
      <div className="deadline-top">
        <div>
          <div className="deadline-code">{code}</div>
          <h3>{title}</h3>
        </div>
        <span className={`pill ${meta.tone}`}>
          {meta.tone === "critical" && <span className="pulse-dot" />}
          {meta.label}
        </span>
      </div>
      <p>{detail}</p>
      <div className="deadline-progress">
        <div className="deadline-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="deadline-date">{formatDate(dueDate)}</div>
    </article>
  );
}

// Bottom Navigation
function BottomNav({ current, navigate }: { current: Route; navigate: (r: Route) => void }) {
  const items = [
    { route: "dashboard" as Route, icon: "⬡", label: "Home" },
    { route: "scan" as Route, icon: "⊕", label: "Scan" },
    { route: "invoices" as Route, icon: "☰", label: "Invoices" },
    { route: "export" as Route, icon: "↓", label: "Export" },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(({ route, icon, label }) => (
        <button
          key={route}
          className={`bnav-item ${current === route ? "active" : ""}`}
          onClick={() => navigate(route)}
        >
          <span className="bnav-icon">{icon}</span>
          <span className="bnav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function Dashboard({ navigate, onLogout }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState(
    getBusinessContext()?.name || "Your Business"
  );

  const currentMonth = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
  const currentDateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  useEffect(() => {
    const token = getToken();
    const business = getBusinessContext();
    const businessId = business?.id ?? "";
    const storedBusinessName = business?.name ?? "";

    if (!token || !businessId) {
      setData(MOCK_DATA);
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      try {
        const [businessRes, invoiceRes, returnsRes] = await Promise.all([
          fetch(`${BASE_URL}/businesses/${businessId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/invoices?business_id=${businessId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/returns?business_id=${businessId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const businessPayload = await businessRes.json().catch(() => null);
        const invoicePayload = await invoiceRes.json().catch(() => null);
        const returnsPayload = await returnsRes.json().catch(() => null);

        if (businessRes.ok) {
          const liveBusinessName = businessPayload?.business?.legal_name ?? businessPayload?.business?.trade_name ?? storedBusinessName;
          if (liveBusinessName) setBusinessName(liveBusinessName);
        }

        if (!invoiceRes.ok) throw new Error("Invoice data unavailable");

        const rawInvoices: RawInvoice[] = Array.isArray(invoicePayload?.invoices ?? invoicePayload?.data)
          ? (invoicePayload?.invoices ?? invoicePayload?.data) : [];
        const invoices = rawInvoices.map(normalizeInvoice);
        const returns: ReturnSummary[] = Array.isArray(returnsPayload?.returns ?? returnsPayload?.data)
          ? (returnsPayload?.returns ?? returnsPayload?.data) : [];

        let totalSales = 0, totalPurchases = 0, itcAvailable = 0, taxPayable = 0;

        for (const invoice of rawInvoices) {
          const taxableValue = Number(invoice.taxable_value ?? 0);
          const taxAmount = Number(invoice.cgst_amount ?? 0) + Number(invoice.sgst_amount ?? 0) + Number(invoice.igst_amount ?? 0);
          if (invoice.invoice_type === "sale") { totalSales += taxableValue; taxPayable += taxAmount; }
          else { totalPurchases += taxableValue; itcAvailable += taxAmount; }
        }

        const gstr1 = returns.find(i => i.return_type === "GSTR1");
        const gstr3b = returns.find(i => i.return_type === "GSTR3B");

        setData({
          totalSales, totalPurchases, itcAvailable,
          taxPayable: Math.max(0, taxPayable - itcAvailable),
          gstr1DueDate: gstr1?.due_date || MOCK_DATA.gstr1DueDate,
          gstr3bDueDate: gstr3b?.due_date || MOCK_DATA.gstr3bDueDate,
          recentInvoices: invoices.slice(0, 5),
        });
      } catch {
        setData(MOCK_DATA);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="load">
          <div className="load-spinner" />
          <b>KhataGST</b>
          <span>Building your workspace...</span>
        </div>
      </>
    );
  }

  const dashboard = data ?? MOCK_DATA;
  const health = calcHealthScore(dashboard);
  const liabilityCopy = dashboard.taxPayable > 0
    ? "Net GST liability after ITC adjustment."
    : "ITC offsets your liability this cycle.";
  const filingMode = dashboard.taxPayable > 0 ? "Liability to settle" : "Balanced with credit";

  const cards = [
    ["green", "Taxable sales", formatRupees(dashboard.totalSales), "Current period"],
    ["blue", "Taxable purchases", formatRupees(dashboard.totalPurchases), "Input invoices"],
    ["violet", "ITC available", formatRupees(dashboard.itcAvailable), "Captured credit"],
    [dashboard.taxPayable > 0 ? "amber" : "green", "Net GST payable", formatRupees(dashboard.taxPayable), "After ITC offset"],
  ] as const;

  return (
    <>
      <style>{STYLES}</style>

      {/* Top Nav */}
      <nav className="top">
        <div className="brand">
          <b>Khata<span>GST</span></b>
          <small>Financial command center</small>
        </div>
        <div className="center">
          <span className="chip">{businessName}</span>
          <span className="chip">{currentMonth}</span>
        </div>
        <div className="topnav-actions">
          <button className="btn soft" onClick={onLogout}>Log out</button>
        </div>
      </nav>

      <div className="page">

        {/* Hero + Liability */}
        <section className="hero-grid">
          <article className="hero anim-fade" style={{ animationDelay: "0s" }}>
            <div className="kicker">Reporting Cockpit</div>
            <h1>{businessName}</h1>
            <p>Monitor liability, credit, deadlines, and invoice activity from one clean workspace.</p>
            <div className="hero-actions">
              <button className="btn pri" onClick={() => navigate("scan")}>Capture invoice</button>
              <button className="btn dark" onClick={() => navigate("invoices")}>Open register</button>
            </div>
            <div className="hero-strip">
              <div><span>Today</span><strong>{currentDateLabel}</strong></div>
              <div><span>Invoices</span><strong>{dashboard.recentInvoices.length} visible</strong></div>
              <div><span>Filing posture</span><strong>{filingMode}</strong></div>
            </div>
          </article>

          <aside className="side anim-fade" style={{ animationDelay: "0.15s" }}>
            <div className="liability">
              <span>Net GST payable</span>
              <strong className={dashboard.taxPayable > 0 ? "bad" : "good"}>
                {formatRupees(dashboard.taxPayable)}
              </strong>
              <p>{liabilityCopy}</p>
            </div>
            <div className="mini-grid">
              <div className="mini"><span>Output side</span><strong>{formatRupees(dashboard.totalSales)}</strong></div>
              <div className="mini"><span>Credit side</span><strong>{formatRupees(dashboard.itcAvailable)}</strong></div>
            </div>
          </aside>
        </section>

        {/* Stat Cards */}
        <section className="stats">
          {cards.map(([tone, label, value, note], idx) => (
            <article key={label} className={`stat ${tone} anim-slide`} style={{ animationDelay: `${0.3 + idx * 0.08}s` }}>
              <div className="label">{label}</div>
              <div className="value">{value}</div>
              <div className="note">{note}</div>
            </article>
          ))}
        </section>

        {/* GST Health + Donut Chart */}
        <section className="grid anim-fade" style={{ animationDelay: "0.5s" }}>
          <div className="panel chart-panel">
            <div className="head">
              <div>
                <div className="kicker label">Invoice Breakdown</div>
                <h2>Fund flow</h2>
              </div>
            </div>
            <div className="chart-body">
              <DonutChart
                sales={dashboard.totalSales}
                purchases={dashboard.totalPurchases}
                itc={dashboard.itcAvailable}
              />
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="dot" style={{ background: "#34d399" }} />
                  <div>
                    <div className="legend-label">Sales</div>
                    <div className="legend-val">{formatRupees(dashboard.totalSales)}</div>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ background: "#60a5fa" }} />
                  <div>
                    <div className="legend-label">Purchases</div>
                    <div className="legend-val">{formatRupees(dashboard.totalPurchases)}</div>
                  </div>
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ background: "#a78bfa" }} />
                  <div>
                    <div className="legend-label">ITC</div>
                    <div className="legend-val">{formatRupees(dashboard.itcAvailable)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel health-panel">
            <div className="head">
              <div>
                <div className="kicker label">Compliance Score</div>
                <h2>GST health</h2>
              </div>
            </div>
            <div className="health-body">
              <HealthRing score={health.score} label={health.label} color={health.color} />
              <div className="health-checks">
                <div className="hcheck">
                  <span className={daysUntil(dashboard.gstr1DueDate) >= 0 ? "ok" : "no"}>
                    {daysUntil(dashboard.gstr1DueDate) >= 0 ? "✓" : "✗"}
                  </span>
                  GSTR-1 {daysUntil(dashboard.gstr1DueDate) >= 0 ? "on track" : "overdue"}
                </div>
                <div className="hcheck">
                  <span className={daysUntil(dashboard.gstr3bDueDate) >= 0 ? "ok" : "no"}>
                    {daysUntil(dashboard.gstr3bDueDate) >= 0 ? "✓" : "✗"}
                  </span>
                  GSTR-3B {daysUntil(dashboard.gstr3bDueDate) >= 0 ? "on track" : "overdue"}
                </div>
                <div className="hcheck">
                  <span className={dashboard.taxPayable === 0 ? "ok" : "warn"}>
                    {dashboard.taxPayable === 0 ? "✓" : "!"}
                  </span>
                  {dashboard.taxPayable === 0 ? "Liability cleared" : "Liability pending"}
                </div>
                <div className="hcheck">
                  <span className={!dashboard.recentInvoices.some(i => i.gst_status === "unmatched") ? "ok" : "no"}>
                    {!dashboard.recentInvoices.some(i => i.gst_status === "unmatched") ? "✓" : "✗"}
                  </span>
                  {dashboard.recentInvoices.some(i => i.gst_status === "unmatched") ? "Mismatches found" : "No mismatches"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Deadlines */}
        <section className="grid anim-fade" style={{ animationDelay: "0.55s" }}>
          <div className="panel">
            <div className="head">
              <div>
                <div className="kicker label">Compliance Calendar</div>
                <h2>Deadline runway</h2>
              </div>
              <button className="link" onClick={() => navigate("export")}>Prepare export</button>
            </div>
            <div className="deadline-grid">
              <DeadlineCard code="GSTR-1" title="Sales return"
                detail="Review outward supply before generating your filing workbook."
                dueDate={dashboard.gstr1DueDate} delay="0.65s" />
              <DeadlineCard code="GSTR-3B" title="Tax payment"
                detail="Validate liability after ITC and plan your payment."
                dueDate={dashboard.gstr3bDueDate} delay="0.7s" />
            </div>
          </div>

          <aside className="panel side-panel anim-fade" style={{ animationDelay: "0.6s" }}>
            <div>
              <div className="kicker label">Control Center</div>
              <h2>Quick actions</h2>
            </div>
            <div className="actions-list">
              <button className="action" onClick={() => navigate("scan")}>
                <strong>📷  Capture invoice</strong>
                <span>Upload a bill and extract fields with AI.</span>
              </button>
              <button className="action" onClick={() => navigate("invoices")}>
                <strong>📋  Invoice register</strong>
                <span>View all transactions and GST matching status.</span>
              </button>
              <button className="action" onClick={() => navigate("export")}>
                <strong>📦  Export package</strong>
                <span>Generate Excel or CSV for filing.</span>
              </button>
            </div>
          </aside>
        </section>

        {/* Recent Invoices */}
        <section className="panel anim-fade" style={{ animationDelay: "0.75s" }}>
          <div className="head">
            <div>
              <div className="kicker label">Recent Activity</div>
              <h2>Latest invoices</h2>
            </div>
            <button className="link" onClick={() => navigate("invoices")}>View all</button>
          </div>

          {dashboard.recentInvoices.length === 0 ? (
            <div className="empty">
              <strong>No invoices yet</strong>
              <span>Scan your first invoice to activate the dashboard.</span>
              <button className="btn pri" onClick={() => navigate("scan")}>Scan first invoice</button>
            </div>
          ) : (
            <div className="rows">
              {dashboard.recentInvoices.map((invoice) => {
                const status = getStatusTone(invoice.gst_status);
                return (
                  <button key={invoice.id} className="row" onClick={() => navigate("invoices")}>
                    <div>
                      <div className="num">{invoice.invoice_number}</div>
                      <div className="party">{invoice.party_name}</div>
                    </div>
                    <div className="meta">
                      <span className={`type ${invoice.invoice_type === "sale" ? "sale" : "purchase"}`}>
                        {invoice.invoice_type === "sale" ? "Sale" : "Purchase"}
                      </span>
                      <span className={`status ${status.tone}`}>{status.label}</span>
                      <span className="date">{formatDate(invoice.invoice_date)}</span>
                    </div>
                    <div className="amt">{formatRupees(invoice.total_amount)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Bottom Nav */}
      <BottomNav current="dashboard" navigate={navigate} />
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#080c18;font-family:'Syne',sans-serif;color:#f1f5f9;-webkit-font-smoothing:antialiased}
button{font-family:inherit}

/* Loading */
.load{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.load b{font:700 28px 'IBM Plex Mono',monospace;background:linear-gradient(135deg,#fff,rgba(255,255,255,.6));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.load span{font-size:14px;color:#64748b}
.load-spinner{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.08);border-top-color:#ff6b00;animation:spin .7s linear infinite}

/* Top Nav */
.top{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(8,12,24,.9);backdrop-filter:blur(20px)}
.brand{display:flex;flex-direction:column;gap:2px}
.brand b{font:700 18px 'IBM Plex Mono',monospace;color:#fff}
.brand b span{background:linear-gradient(135deg,#ff6b00,#ff9a3d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.brand small,.kicker,.label{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.center{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}
.chip{display:inline-flex;align-items:center;padding:7px 13px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);font-size:12px;font-weight:600;color:rgba(255,255,255,.6)}
.topnav-actions{display:flex;gap:8px}

/* Buttons */
.btn,.link{border:none;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease;font-family:'Syne',sans-serif}
.btn:hover,.link:hover{transform:translateY(-1px)}
.btn{padding:10px 16px;border-radius:14px;font-size:13px;font-weight:700}
.soft{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.08)}
.soft:hover{background:rgba(255,255,255,.1)}
.pri{background:linear-gradient(135deg,#ff7a1a,#e8590c);color:#fff;box-shadow:0 8px 20px rgba(234,88,12,.25)}
.pri:hover{box-shadow:0 12px 28px rgba(234,88,12,.4)}
.dark{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.1)}
.dark:hover{background:rgba(255,255,255,.1)}
.link{padding:0;background:none;color:#ff8a3d;font-size:13px;font-weight:700}
.link:hover{color:#ff6b00}
.hero-actions{display:flex;flex-wrap:wrap;gap:8px;position:relative;z-index:2}

/* Page */
.page{max-width:1200px;margin:0 auto;padding:24px 20px 110px;display:flex;flex-direction:column;gap:18px}
.hero-grid,.grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.82fr);gap:16px}

/* Hero */
.hero{position:relative;overflow:hidden;padding:32px;border-radius:28px;background:linear-gradient(135deg,#111827 0%,#1a2444 50%,#141c35 100%);color:#fff;border:1px solid rgba(255,255,255,.06);box-shadow:0 24px 56px rgba(0,0,0,.5)}
.hero::before{content:'';position:absolute;top:-40%;right:-20%;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,107,0,.2),transparent 70%);filter:blur(70px);animation:glow 8s ease-in-out infinite;pointer-events:none}
@keyframes glow{0%,100%{opacity:.5;transform:translate(0,0)}50%{opacity:.9;transform:translate(20px,-10px)}}
.hero .kicker{position:relative;z-index:2;margin-bottom:10px;color:rgba(255,255,255,.35)}
.hero h1{position:relative;z-index:2;margin:0;font-size:clamp(26px,4vw,42px);line-height:1;font-weight:800;letter-spacing:-.04em;background:linear-gradient(180deg,#fff 20%,rgba(255,255,255,.55) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero p{position:relative;z-index:2;max-width:52ch;margin:14px 0 18px;font-size:14px;line-height:1.8;color:rgba(255,255,255,.45)}
.hero-strip{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}
.hero-strip div{padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04)}
.hero-strip span{display:block;margin-bottom:5px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.hero-strip strong{font-size:13px;color:#fff}

/* Side */
.side{display:flex;flex-direction:column;gap:12px}
.liability{padding:20px;border-radius:22px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03)}
.liability span{display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.liability strong{display:block;margin-bottom:8px;font:700 32px 'IBM Plex Mono',monospace}
.liability .good{background:linear-gradient(135deg,#34d399,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.liability .bad{background:linear-gradient(135deg,#fb923c,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.liability p{margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.4)}
.mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.mini{padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03)}
.mini span{display:block;margin-bottom:5px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.mini strong{font-size:14px;color:#fff;font-family:'IBM Plex Mono',monospace}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.stat{position:relative;overflow:hidden;padding:20px;border-radius:20px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);transition:transform .3s ease,border-color .3s ease}
.stat:hover{transform:translateY(-4px)}
.stat .label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.stat .value{margin:10px 0 6px;font:700 22px 'IBM Plex Mono',monospace}
.stat .note{font-size:11px;color:rgba(255,255,255,.3)}
.green .value{background:linear-gradient(135deg,#34d399,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.green:hover{border-color:rgba(52,211,153,.2)}
.blue .value{background:linear-gradient(135deg,#60a5fa,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.blue:hover{border-color:rgba(96,165,250,.2)}
.violet .value{background:linear-gradient(135deg,#a78bfa,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.violet:hover{border-color:rgba(167,139,250,.2)}
.amber .value{background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.amber:hover{border-color:rgba(251,191,36,.2)}

/* Panel */
.panel{padding:22px;border-radius:24px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03)}
.panel h2{margin:0;font-size:20px;line-height:1.1;font-weight:800;letter-spacing:-.03em;color:#fff}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}

/* Chart panel */
.chart-panel .chart-body{display:flex;align-items:center;gap:24px;padding-top:8px}
.chart-legend{display:flex;flex-direction:column;gap:14px}
.legend-item{display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.legend-label{font-size:11px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.legend-val{font:700 14px 'IBM Plex Mono',monospace;color:#fff}

/* Health panel */
.health-panel .health-body{display:flex;align-items:center;gap:20px;padding-top:8px}
.health-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}
.health-label{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.health-checks{display:flex;flex-direction:column;gap:10px}
.hcheck{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.6)}
.hcheck span{width:20px;height:20px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
.hcheck span.ok{background:rgba(52,211,153,.15);color:#34d399}
.hcheck span.no{background:rgba(239,68,68,.15);color:#ef4444}
.hcheck span.warn{background:rgba(251,191,36,.15);color:#fbbf24}

/* Deadlines */
.deadline-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.deadline{padding:18px;border-radius:18px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);transition:transform .2s ease}
.deadline:hover{transform:translateY(-2px)}
.deadline-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.deadline-code{font:700 12px 'IBM Plex Mono',monospace;letter-spacing:.06em}
.deadline h3{margin:4px 0 0;font-size:16px;line-height:1.2;color:#fff}
.deadline p{margin:10px 0 12px;font-size:12px;line-height:1.7;color:rgba(255,255,255,.38)}
.deadline-date{margin-top:8px;font-size:12px;font-weight:700;color:rgba(255,255,255,.6)}
.deadline-progress{width:100%;height:3px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}
.deadline-bar{height:100%;border-radius:3px;transition:width 1s ease}
.stable .deadline-code{color:#34d399}.stable .deadline-bar{background:linear-gradient(90deg,#34d399,#10b981)}
.warning .deadline-code{color:#fbbf24}.warning .deadline-bar{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
.critical .deadline-code{color:#ef4444}.critical .deadline-bar{background:linear-gradient(90deg,#ef4444,#dc2626)}
.pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.stable.pill{background:rgba(52,211,153,.08);color:#34d399;border:1px solid rgba(52,211,153,.12)}
.warning.pill{background:rgba(251,191,36,.08);color:#fbbf24;border:1px solid rgba(251,191,36,.12)}
.critical.pill{background:rgba(239,68,68,.08);color:#ef4444;border:1px solid rgba(239,68,68,.12)}
.pulse-dot{width:5px;height:5px;border-radius:50%;background:#ef4444;animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}

/* Actions */
.side-panel{display:flex;flex-direction:column;gap:14px}
.actions-list{display:flex;flex-direction:column;gap:8px}
.action{width:100%;padding:16px;border-radius:16px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);text-align:left;cursor:pointer;transition:transform .2s ease,border-color .2s ease}
.action:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.2);background:rgba(255,107,0,.04)}
.action strong{display:block;margin-bottom:5px;font-size:14px;font-weight:800;color:#fff}
.action span{font-size:12px;line-height:1.6;color:rgba(255,255,255,.38)}

/* Invoices */
.rows{display:flex;flex-direction:column;gap:8px}
.row{width:100%;display:grid;grid-template-columns:minmax(0,1.2fr) auto auto;align-items:center;gap:12px;padding:14px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);text-align:left;cursor:pointer;transition:transform .2s ease,border-color .2s ease}
.row:hover{transform:translateX(4px);border-color:rgba(255,255,255,.1)}
.num{font:700 12px 'IBM Plex Mono',monospace;color:rgba(255,255,255,.55)}
.party{font-size:13px;color:rgba(255,255,255,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
.type,.status{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.type.sale{background:rgba(52,211,153,.08);color:#34d399;border:1px solid rgba(52,211,153,.1)}
.type.purchase{background:rgba(96,165,250,.08);color:#60a5fa;border:1px solid rgba(96,165,250,.1)}
.status.good{background:rgba(52,211,153,.08);color:#34d399}
.status.warn{background:rgba(251,191,36,.08);color:#fbbf24}
.status.bad{background:rgba(239,68,68,.08);color:#ef4444}
.date{font-size:11px;color:rgba(255,255,255,.28)}
.amt{font:700 14px 'IBM Plex Mono',monospace;color:#fff}
.empty{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:20px 0}
.empty strong{font-size:16px;color:#fff}
.empty span{font-size:13px;color:rgba(255,255,255,.38)}

/* Bottom Nav */
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:space-around;padding:10px 8px calc(10px + env(safe-area-inset-bottom));background:rgba(8,12,24,.95);border-top:1px solid rgba(255,255,255,.07);backdrop-filter:blur(20px)}
.bnav-item{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 20px;border:none;background:none;cursor:pointer;border-radius:16px;transition:background .2s ease,transform .2s ease;min-width:64px}
.bnav-item:hover{background:rgba(255,255,255,.05);transform:translateY(-2px)}
.bnav-item.active{background:rgba(255,107,0,.1)}
.bnav-icon{font-size:18px;line-height:1;color:rgba(255,255,255,.35);transition:color .2s ease}
.bnav-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3);transition:color .2s ease}
.bnav-item.active .bnav-icon,.bnav-item.active .bnav-label{color:#ff7a1a}

/* Animations */
.anim-fade{opacity:0;transform:translateY(16px);animation:fade-up .7s cubic-bezier(.16,1,.3,1) forwards}
.anim-slide{opacity:0;transform:translateY(12px);animation:slide-up .5s cubic-bezier(.16,1,.3,1) forwards}
@keyframes fade-up{to{opacity:1;transform:translateY(0)}}
@keyframes slide-up{to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}

/* Responsive */
@media (max-width:1080px){.top{grid-template-columns:1fr}.hero-grid,.grid,.stats{grid-template-columns:1fr}.center{display:none}}
@media (max-width:780px){
  .hero-strip,.mini-grid,.deadline-grid{grid-template-columns:1fr}
  .row{grid-template-columns:1fr}
  .meta{justify-content:flex-start}
  .stats{grid-template-columns:repeat(2,1fr)}
  .chart-panel .chart-body{flex-direction:column;align-items:flex-start}
  .health-panel .health-body{flex-direction:column;align-items:flex-start}
}
@media (max-width:640px){
  .page{padding:16px 12px 110px}
  .top{padding:12px 14px}
  .hero,.panel{padding:18px;border-radius:20px}
  .head{flex-direction:column;align-items:flex-start}
  .hero h1{font-size:26px}
  .stats{grid-template-columns:1fr}
  .topnav-actions .btn{font-size:12px;padding:8px 12px}
}
`;
