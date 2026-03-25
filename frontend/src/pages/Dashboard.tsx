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

function DeadlineCard({
  code,
  title,
  detail,
  dueDate,
  delay,
}: {
  code: string;
  title: string;
  detail: string;
  dueDate: string;
  delay: string;
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

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@500;600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:#0a0e1a;font-family:'Inter',-apple-system,sans-serif;color:#f1f5f9;-webkit-font-smoothing:antialiased}
button{font-family:inherit}

/* ── Loading ──────────────────────────────────── */
.load{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
.load b{font:700 28px 'IBM Plex Mono',monospace;background:linear-gradient(135deg,#fff,rgba(255,255,255,.65));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.load span{font-size:14px;color:#64748b}
.load-spinner{width:36px;height:36px;border-radius:50%;border:3px solid rgba(255,255,255,.1);border-top-color:#ff6b00;animation:spin .7s linear infinite}

/* ── Top Navigation ───────────────────────────── */
.top{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(10,14,26,.85);backdrop-filter:blur(20px) saturate(1.8)}

.brand{display:flex;flex-direction:column;gap:3px}
.brand b{font:700 19px 'IBM Plex Mono',monospace;color:#fff}
.brand b span{background:linear-gradient(135deg,#ff6b00,#ff8a3d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.brand small,.kicker,.label{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.35)}

.center,.actions,.hero-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.center{justify-content:center}

.chip{display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);font-size:12px;font-weight:600;color:rgba(255,255,255,.65);backdrop-filter:blur(8px)}

/* ── Buttons ──────────────────────────────────── */
.btn,.link{border:none;cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}
.btn:hover,.link:hover{transform:translateY(-1px)}
.btn{padding:11px 16px;border-radius:14px;font-size:13px;font-weight:700}
.soft{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.08)}
.soft:hover{background:rgba(255,255,255,.1)}
.pri{background:linear-gradient(135deg,#ff7a1a,#e8590c);color:#fff;box-shadow:0 8px 20px rgba(234,88,12,.25)}
.pri:hover{box-shadow:0 12px 28px rgba(234,88,12,.35)}
.dark{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.1)}
.dark:hover{background:rgba(255,255,255,.1)}
.link{padding:0;background:none;color:#ff8a3d;font-size:13px;font-weight:700}
.link:hover{color:#ff6b00}

/* ── Page layout ──────────────────────────────── */
.page{max-width:1200px;margin:0 auto;padding:28px 20px 100px;display:flex;flex-direction:column;gap:20px}
.hero-grid,.grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.82fr);gap:16px}

/* ── Hero section ─────────────────────────────── */
.hero{position:relative;overflow:hidden;padding:34px;border-radius:28px;background:linear-gradient(135deg,#131b30 0%,#172044 50%,#1a1f3a 100%);color:#fff;border:1px solid rgba(255,255,255,.06);box-shadow:0 24px 56px rgba(0,0,0,.4)}
.hero::before{content:'';position:absolute;top:-50%;right:-30%;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,107,0,.18),transparent 70%);filter:blur(60px);animation:hero-glow 8s ease-in-out infinite;pointer-events:none}
.hero::after{content:'';position:absolute;bottom:-40%;left:-20%;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,.12),transparent 70%);filter:blur(60px);animation:hero-glow 10s ease-in-out infinite reverse;pointer-events:none}

@keyframes hero-glow{0%,100%{opacity:.5;transform:translate(0,0)}50%{opacity:.8;transform:translate(20px,-10px)}}

.hero .kicker{position:relative;z-index:2;margin-bottom:12px;color:rgba(255,255,255,.4)}
.hero h1{position:relative;z-index:2;margin:0;font-size:clamp(30px,4.5vw,46px);line-height:1;font-weight:900;letter-spacing:-.04em;background:linear-gradient(180deg,#fff 20%,rgba(255,255,255,.6) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.hero p{position:relative;z-index:2;max-width:56ch;margin:16px 0 0;font-size:14px;line-height:1.8;color:rgba(255,255,255,.5)}

.hero-actions{position:relative;z-index:2}

.hero-strip{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
.hero-strip div{padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.04);backdrop-filter:blur(8px);transition:transform .2s ease,border-color .2s ease}
.hero-strip div:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.2)}
.hero-strip span{display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.hero-strip strong{font-size:14px;color:#fff}

/* ── Side panels ──────────────────────────────── */
.side{display:flex;flex-direction:column;gap:14px}
.liability{padding:22px;border-radius:24px;border:1px solid rgba(255,255,255,.06);background:linear-gradient(160deg,rgba(20,26,48,.9),rgba(15,20,35,.95));backdrop-filter:blur(12px);transition:transform .2s ease}
.liability:hover{transform:translateY(-2px)}
.liability span{display:block;margin-bottom:8px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.liability strong{display:block;margin-bottom:10px;font:700 34px 'IBM Plex Mono',monospace}
.liability .good{background:linear-gradient(135deg,#34d399,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.liability .bad{background:linear-gradient(135deg,#fb923c,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.liability p{margin:0;font-size:13px;line-height:1.7;color:rgba(255,255,255,.45)}

.mini-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.mini{padding:18px;border-radius:20px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);backdrop-filter:blur(8px);transition:transform .2s ease,border-color .2s ease}
.mini:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.15)}
.mini span{display:block;margin-bottom:6px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.mini strong{font-size:15px;color:#fff}

/* ── Stat cards ───────────────────────────────── */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.stat{position:relative;overflow:hidden;padding:22px;border-radius:22px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);backdrop-filter:blur(12px);transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease}
.stat:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.3)}
.stat::after{content:'';position:absolute;top:-50%;right:-30%;width:120px;height:120px;border-radius:50%;opacity:0;transition:opacity .3s ease;pointer-events:none;filter:blur(40px)}
.stat:hover::after{opacity:1}

.stat .label{font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.stat .value{margin:10px 0 6px;font:700 24px 'IBM Plex Mono',monospace}
.stat .note{font-size:11px;line-height:1.5;color:rgba(255,255,255,.35)}

.green .value{background:linear-gradient(135deg,#34d399,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.green:hover{border-color:rgba(52,211,153,.2)}.green::after{background:rgba(52,211,153,.15)}
.blue .value{background:linear-gradient(135deg,#60a5fa,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.blue:hover{border-color:rgba(96,165,250,.2)}.blue::after{background:rgba(96,165,250,.15)}
.violet .value{background:linear-gradient(135deg,#a78bfa,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.violet:hover{border-color:rgba(167,139,250,.2)}.violet::after{background:rgba(167,139,250,.15)}
.amber .value{background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.amber:hover{border-color:rgba(251,191,36,.2)}.amber::after{background:rgba(251,191,36,.15)}

/* ── Panels ───────────────────────────────────── */
.panel{padding:24px;border-radius:24px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);backdrop-filter:blur(12px)}
.panel h2{margin:0;font-size:22px;line-height:1.1;font-weight:800;letter-spacing:-.03em;color:#fff}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}

/* ── Deadline cards ───────────────────────────── */
.deadline-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:18px}
.deadline{padding:20px;border-radius:20px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);transition:transform .2s ease,border-color .2s ease}
.deadline:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.12)}
.deadline-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.deadline-code{font:700 12px 'IBM Plex Mono',monospace;letter-spacing:.06em}
.deadline h3{margin:4px 0 0;font-size:17px;line-height:1.2;color:#fff}
.deadline p{margin:10px 0 12px;font-size:12px;line-height:1.7;color:rgba(255,255,255,.4)}
.deadline-date{margin-top:8px;font-size:12px;font-weight:700;color:rgba(255,255,255,.65)}

.deadline-progress{width:100%;height:4px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden}
.deadline-bar{height:100%;border-radius:4px;transition:width 1s ease}

.stable .deadline-code{color:#34d399}.stable .deadline-bar{background:linear-gradient(90deg,#34d399,#10b981)}
.warning .deadline-code{color:#fbbf24}.warning .deadline-bar{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
.critical .deadline-code{color:#ef4444}.critical .deadline-bar{background:linear-gradient(90deg,#ef4444,#dc2626)}

.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.stable.pill{background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.15)}
.warning.pill{background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.15)}
.critical.pill{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.15)}

.pulse-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}

/* ── Side panel / actions ─────────────────────── */
.side-panel{display:flex;flex-direction:column;gap:16px}
.actions-list,.rows{display:flex;flex-direction:column;gap:10px}

.action{width:100%;padding:18px;border-radius:18px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);text-align:left;cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease}
.action:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.2);background:rgba(255,107,0,.04)}
.action strong{display:block;margin-bottom:6px;font-size:14px;font-weight:800;color:#fff}
.action span{font-size:12px;line-height:1.7;color:rgba(255,255,255,.4)}

.health{padding:18px;border-radius:20px;border:1px solid rgba(255,107,0,.15);background:linear-gradient(160deg,rgba(255,107,0,.06),rgba(255,107,0,.02))}
.health .label{color:#ff8a3d}
.health strong{display:block;margin:8px 0;font:700 16px 'IBM Plex Mono',monospace;color:#ff8a3d}
.health p{margin:0;font-size:12px;line-height:1.7;color:rgba(255,255,255,.4)}

/* ── Invoice rows ─────────────────────────────── */
.rows{margin-top:18px}
.row{width:100%;display:grid;grid-template-columns:minmax(0,1.2fr) auto auto;align-items:center;gap:14px;padding:16px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);text-align:left;cursor:pointer;transition:transform .2s ease,border-color .2s ease,background .2s ease}
.row:hover{transform:translateX(4px);border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.04)}
.num{font:700 12px 'IBM Plex Mono',monospace;letter-spacing:.04em;color:rgba(255,255,255,.6)}
.party{font-size:13px;color:rgba(255,255,255,.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.type,.status{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.type.sale{background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.12)}
.type.purchase{background:rgba(96,165,250,.1);color:#60a5fa;border:1px solid rgba(96,165,250,.12)}
.status.good{background:rgba(52,211,153,.1);color:#34d399}
.status.warn{background:rgba(251,191,36,.1);color:#fbbf24}
.status.bad{background:rgba(239,68,68,.1);color:#ef4444}
.date{font-size:11px;color:rgba(255,255,255,.3)}
.amt{font:700 14px 'IBM Plex Mono',monospace;color:#fff}

.empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:28px 0 4px}
.empty strong{font-size:16px;color:#fff}
.empty span{font-size:13px;color:rgba(255,255,255,.4)}

/* ── Animations ───────────────────────────────── */
.anim-fade{opacity:0;transform:translateY(16px);animation:fade-up .7s cubic-bezier(.16,1,.3,1) forwards}
.anim-slide{opacity:0;transform:translateY(12px);animation:slide-up .5s cubic-bezier(.16,1,.3,1) forwards}

@keyframes fade-up{to{opacity:1;transform:translateY(0)}}
@keyframes slide-up{to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Responsive ───────────────────────────────── */
@media (max-width:1080px){.top{grid-template-columns:1fr}.hero-grid,.grid,.stats{grid-template-columns:1fr}.center{display:none}}
@media (max-width:780px){.hero-strip,.mini-grid,.deadline-grid{grid-template-columns:1fr}.row{grid-template-columns:1fr}.meta{justify-content:flex-start}.stats{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.page{padding:18px 14px 100px}.top{padding:12px 14px}.hero,.panel{padding:22px;border-radius:22px}.head{flex-direction:column;align-items:flex-start}.hero h1{font-size:28px}.stats{grid-template-columns:1fr}}
`;

export default function Dashboard({ navigate, onLogout }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState(
    getBusinessContext()?.name || "Your Business"
  );

  const currentMonth = new Date().toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const currentDateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

        const businessPayload = await businessRes.json().catch(() => null);
        const invoicePayload = await invoiceRes.json().catch(() => null);
        const returnsPayload = await returnsRes.json().catch(() => null);

        if (businessRes.ok) {
          const liveBusinessName =
            businessPayload?.business?.legal_name ??
            businessPayload?.business?.trade_name ??
            storedBusinessName;
          if (liveBusinessName) setBusinessName(liveBusinessName);
        }

        if (!invoiceRes.ok) throw new Error("Invoice data unavailable");

        const rawInvoices: RawInvoice[] = Array.isArray(
          invoicePayload?.invoices ?? invoicePayload?.data
        )
          ? (invoicePayload?.invoices ?? invoicePayload?.data)
          : [];
        const invoices = rawInvoices.map(normalizeInvoice);
        const returns: ReturnSummary[] = Array.isArray(
          returnsPayload?.returns ?? returnsPayload?.data
        )
          ? (returnsPayload?.returns ?? returnsPayload?.data)
          : [];

        let totalSales = 0;
        let totalPurchases = 0;
        let itcAvailable = 0;
        let taxPayable = 0;

        for (const invoice of rawInvoices) {
          const taxableValue = Number(invoice.taxable_value ?? 0);
          const taxAmount =
            Number(invoice.cgst_amount ?? 0) +
            Number(invoice.sgst_amount ?? 0) +
            Number(invoice.igst_amount ?? 0);

          if (invoice.invoice_type === "sale") {
            totalSales += taxableValue;
            taxPayable += taxAmount;
          } else {
            totalPurchases += taxableValue;
            itcAvailable += taxAmount;
          }
        }

        const gstr1 = returns.find((item) => item.return_type === "GSTR1");
        const gstr3b = returns.find((item) => item.return_type === "GSTR3B");

        setData({
          totalSales,
          totalPurchases,
          itcAvailable,
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
          <span>Building your reporting workspace...</span>
        </div>
      </>
    );
  }

  const dashboard = data ?? MOCK_DATA;
  const liabilityCopy =
    dashboard.taxPayable > 0
      ? "Net GST liability remains outstanding after available ITC adjustment."
      : "Available ITC currently offsets the expected liability for this cycle.";
  const filingMode =
    dashboard.taxPayable > 0 ? "Liability to settle" : "Balanced with credit";
  const cards = [
    ["green", "Taxable sales", formatRupees(dashboard.totalSales), "Current reporting period"],
    ["blue", "Taxable purchases", formatRupees(dashboard.totalPurchases), "Input-side invoice value"],
    ["violet", "ITC available", formatRupees(dashboard.itcAvailable), "Captured tax credit"],
    [dashboard.taxPayable > 0 ? "amber" : "green", "Net GST payable", formatRupees(dashboard.taxPayable), "After ITC offset"],
  ] as const;

  return (
    <>
      <style>{STYLES}</style>

      <nav className="top">
        <div className="brand">
          <b>
            Khata<span>GST</span>
          </b>
          <small>Financial command center</small>
        </div>

        <div className="center">
          <span className="chip">{businessName}</span>
          <span className="chip">{currentMonth}</span>
        </div>

        <div className="actions">
          <button className="btn soft" onClick={() => navigate("export")}>
            Export
          </button>
          <button className="btn pri" onClick={() => navigate("scan")}>
            New invoice
          </button>
          <button className="btn soft" onClick={onLogout}>
            Log out
          </button>
        </div>
      </nav>

      <div className="page">
        <section className="hero-grid">
          <article className="hero anim-fade" style={{ animationDelay: "0s" }}>
            <div className="kicker">Reporting Cockpit</div>
            <h1>{businessName}</h1>
            <p>
              Monitor liability, credit, filing deadlines, and invoice activity
              from one premium workspace built for operators who need clean
              compliance visibility.
            </p>

            <div className="hero-actions">
              <button className="btn pri" onClick={() => navigate("scan")}>
                Capture invoice
              </button>
              <button className="btn dark" onClick={() => navigate("invoices")}>
                Open register
              </button>
            </div>

            <div className="hero-strip">
              <div>
                <span>Today</span>
                <strong>{currentDateLabel}</strong>
              </div>
              <div>
                <span>Recent activity</span>
                <strong>{dashboard.recentInvoices.length} invoices visible</strong>
              </div>
              <div>
                <span>Filing posture</span>
                <strong>{filingMode}</strong>
              </div>
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
              <div className="mini">
                <span>Output side</span>
                <strong>{formatRupees(dashboard.totalSales)}</strong>
              </div>
              <div className="mini">
                <span>Credit side</span>
                <strong>{formatRupees(dashboard.itcAvailable)}</strong>
              </div>
            </div>
          </aside>
        </section>

        <section className="stats">
          {cards.map(([tone, label, value, note], idx) => (
            <article
              key={label}
              className={`stat ${tone} anim-slide`}
              style={{ animationDelay: `${0.3 + idx * 0.08}s` }}
            >
              <div className="label">{label}</div>
              <div className="value">{value}</div>
              <div className="note">{note}</div>
            </article>
          ))}
        </section>

        <section className="grid">
          <div className="panel anim-fade" style={{ animationDelay: "0.55s" }}>
            <div className="head">
              <div>
                <div className="kicker label">Compliance Calendar</div>
                <h2>Deadline runway</h2>
              </div>
              <button className="link" onClick={() => navigate("export")}>
                Prepare filing export
              </button>
            </div>

            <div className="deadline-grid">
              <DeadlineCard
                code="GSTR-1"
                title="Sales return"
                detail="Review outward supply data before you generate the filing workbook."
                dueDate={dashboard.gstr1DueDate}
                delay="0.65s"
              />
              <DeadlineCard
                code="GSTR-3B"
                title="Tax payment"
                detail="Validate liability after ITC and keep payment planning on track."
                dueDate={dashboard.gstr3bDueDate}
                delay="0.7s"
              />
            </div>
          </div>

          <aside className="panel side-panel anim-fade" style={{ animationDelay: "0.6s" }}>
            <div>
              <div className="kicker label">Control Center</div>
              <h2>Quick actions</h2>
            </div>

            <div className="actions-list">
              <button className="action" onClick={() => navigate("scan")}>
                <strong>📷  Capture purchase invoice</strong>
                <span>Upload a bill, extract fields, and save it into your register.</span>
              </button>
              <button className="action" onClick={() => navigate("invoices")}>
                <strong>📋  Review invoice register</strong>
                <span>Inspect transactions, amounts, and GST matching status.</span>
              </button>
              <button className="action" onClick={() => navigate("export")}>
                <strong>📦  Create export package</strong>
                <span>Generate Excel or CSV output for filing and accountant review.</span>
              </button>
            </div>

            <div className="health">
              <div className="label">Cycle status</div>
              <strong>{filingMode}</strong>
              <p>{liabilityCopy}</p>
            </div>
          </aside>
        </section>

        <section className="panel anim-fade" style={{ animationDelay: "0.75s" }}>
          <div className="head">
            <div>
              <div className="kicker label">Recent Activity</div>
              <h2>Latest invoices</h2>
            </div>
            <button className="link" onClick={() => navigate("invoices")}>
              View all invoices
            </button>
          </div>

          {dashboard.recentInvoices.length === 0 ? (
            <div className="empty">
              <strong>No invoices recorded yet</strong>
              <span>Start with a new scan to populate the register and activate the dashboard.</span>
              <button className="btn pri" onClick={() => navigate("scan")}>
                Scan first invoice
              </button>
            </div>
          ) : (
            <div className="rows">
              {dashboard.recentInvoices.map((invoice) => {
                const status = getStatusTone(invoice.gst_status);
                return (
                  <button
                    key={invoice.id}
                    className="row"
                    onClick={() => navigate("invoices")}
                  >
                    <div>
                      <div className="num">{invoice.invoice_number}</div>
                      <div className="party">{invoice.party_name}</div>
                    </div>

                    <div className="meta">
                      <span
                        className={`type ${
                          invoice.invoice_type === "sale" ? "sale" : "purchase"
                        }`}
                      >
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
    </>
  );
}
