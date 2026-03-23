import { useState, useEffect } from "react";

type Route = "login" | "dashboard" | "scan" | "invoices";

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  itcAvailable: number;
  taxPayable: number;
  gstr1DueDate: string;
  gstr3bDueDate: string;
  recentInvoices: Invoice[];
}

interface Invoice {
  id: string;
  invoice_number: string;
  party_name: string;
  total_amount: number;
  invoice_date: string;
  type: "sale" | "purchase";
  gst_status: "matched" | "pending" | "unmatched";
}

interface Props {
  navigate: (r: Route) => void;
  onLogout: () => void;
}

const BASE_URL = "/api/v1";

function formatRupees(paise: number): string {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
  return `₹${r.toLocaleString("en-IN")}`;
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const MOCK_DATA: DashboardData = {
  totalSales: 1000000,
  totalPurchases: 500000,
  itcAvailable: 45000,
  taxPayable: 90000,
  gstr1DueDate: "2026-04-11",
  gstr3bDueDate: "2026-04-20",
  recentInvoices: [
    { id: "1", invoice_number: "INV-001", party_name: "Ramesh Traders", total_amount: 1180000, invoice_date: "2026-03-15", type: "sale", gst_status: "matched" },
    { id: "2", invoice_number: "PUR-001", party_name: "Suresh Wholesale", total_amount: 590000, invoice_date: "2026-03-18", type: "purchase", gst_status: "pending" },
  ],
};

export default function Dashboard({ navigate, onLogout }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName] = useState("Test Pvt Ltd");
  const currentMonth = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  useEffect(() => {
    const token = localStorage.getItem("khatagst_token");
    const businessId = localStorage.getItem("khatagst_business_id");
    if (!token || !businessId) { setData(MOCK_DATA); setLoading(false); return; }
    async function fetchDashboard() {
      try {
        const [invRes, retRes] = await Promise.all([
          fetch(`${BASE_URL}/invoices?business_id=${businessId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/returns?business_id=${businessId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const invData = await invRes.json();
        const retData = await retRes.json();
        const invoices = invData.invoices || [];
        const returns = retData.returns || [];
        let totalSales = 0, totalPurchases = 0, itcAvailable = 0, taxPayable = 0;
        for (const inv of invoices) {
          if (inv.invoice_type === "sale") { totalSales += inv.taxable_amount || 0; taxPayable += (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0); }
          else { totalPurchases += inv.taxable_amount || 0; itcAvailable += (inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0); }
        }
        const gstr1 = returns.find((r: any) => r.return_type === "GSTR1");
        const gstr3b = returns.find((r: any) => r.return_type === "GSTR3B");
        setData({ totalSales, totalPurchases, itcAvailable, taxPayable: Math.max(0, taxPayable - itcAvailable), gstr1DueDate: gstr1?.due_date || MOCK_DATA.gstr1DueDate, gstr3bDueDate: gstr3b?.due_date || MOCK_DATA.gstr3bDueDate, recentInvoices: invoices.slice(0, 5) });
      } catch { setData(MOCK_DATA); }
      finally { setLoading(false); }
    }
    fetchDashboard();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>KhataGST</div>
      <div style={{ fontSize: 14, color: "#6b6457" }}>Loading...</div>
    </div>
  );

  const d = data!;

  function DueDateBadge({ label, dueDate, returnType }: { label: string; dueDate: string; returnType: string }) {
    const days = daysUntil(dueDate);
    const isOverdue = days < 0;
    const isUrgent = days >= 0 && days <= 5;
    const color = isOverdue ? "#ef4444" : isUrgent ? "#f97316" : "#22c55e";
    const bg = isOverdue ? "#fef2f2" : isUrgent ? "#fff7ed" : "#f0fdf4";
    return (
      <div style={{ border: `1.5px solid ${color}`, borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: bg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color }}>{returnType}</span>
          <span style={{ fontSize: 11, color: "#6b6457" }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{formatDate(dueDate)}</span>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, padding: "4px 9px", borderRadius: 7, border: `1.5px solid ${color}`, color, background: "white" }}>
          {isOverdue ? `${Math.abs(days)}d late` : days === 0 ? "Today!" : `${days}d left`}
        </span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f5f3ef;font-family:'Sora',sans-serif;color:#1a1611}
        .topbar{background:#1a1611;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100}
        .logo{font-family:'Space Mono',monospace;font-size:17px;color:#fff;font-weight:700}
        .logo span{color:#ff6b00}
        .sbtn{background:#ff6b00;color:#fff;border:none;padding:6px 13px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
        .content{max-width:900px;margin:0 auto;padding:22px 16px 80px}
        .sec-lbl{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#a39b8e;margin-bottom:8px}
        .due-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px}
        .cards-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
        @media(max-width:600px){.cards-grid{grid-template-columns:repeat(2,1fr)}.due-grid{grid-template-columns:1fr}}
        .scard{background:#fff;border-radius:12px;padding:16px 14px;border-top:3px solid;display:flex;flex-direction:column;gap:8px;transition:transform .15s}
        .scard:hover{transform:translateY(-2px)}
        .inv-section{background:#fff;border-radius:12px;border:1px solid #e5e1d8}
        .inv-head{padding:14px 18px;border-bottom:1px solid #e5e1d8;display:flex;align-items:center;justify-content:space-between}
        .inv-row{padding:13px 18px;border-bottom:1px solid #e5e1d8;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;transition:background .15s}
        .inv-row:last-child{border-bottom:none}
        .inv-row:hover{background:#fafaf8}
        @keyframes su{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      `}</style>
      <nav className="topbar">
        <div className="logo">Khata<span>GST</span></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontFamily: "monospace" }}>{currentMonth}</span>
          <button className="sbtn" onClick={() => navigate("scan")}>📷 Scan</button>
          <div style={{ width: 30, height: 30, background: "#ff6b00", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#fff", cursor: "pointer" }} onClick={onLogout}>S</div>
        </div>
      </nav>
      <div className="content">
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Namaste 🙏</h1>
          <p style={{ fontSize: 13, color: "#6b6457" }}>Aaj ka GST summary dekhein</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff3e8", color: "#ff6b00", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, marginTop: 6 }}>🏢 {businessName}</div>
        </div>
        <div className="sec-lbl">Filing Due Dates</div>
        <div className="due-grid">
          <DueDateBadge label="Sales return" dueDate={d.gstr1DueDate} returnType="GSTR-1" />
          <DueDateBadge label="Tax payment" dueDate={d.gstr3bDueDate} returnType="GSTR-3B" />
        </div>
        <div className="sec-lbl">This Month — {currentMonth}</div>
        <div className="cards-grid">
          {[
            { label: "Total Sales", value: formatRupees(d.totalSales), sub: "Taxable value", color: "#16a34a", icon: "📈" },
            { label: "Purchases", value: formatRupees(d.totalPurchases), sub: "Input value", color: "#1d4ed8", icon: "📦" },
            { label: "ITC Available", value: formatRupees(d.itcAvailable), sub: "Input tax credit", color: "#7c3aed", icon: "🏦" },
            { label: "Tax Payable", value: formatRupees(d.taxPayable), sub: "After ITC offset", color: d.taxPayable > 0 ? "#dc2626" : "#16a34a", icon: "💰" },
          ].map((card, i) => (
            <div key={i} className="scard" style={{ borderTopColor: card.color, animationDelay: `${i * 80}ms` }}>
              <div style={{ fontSize: 18 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase", color: "#a39b8e" }}>{card.label}</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 10, color: "#6b6457", marginTop: 2 }}>{card.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="inv-section">
          <div className="inv-head">
            <span style={{ fontSize: 13, fontWeight: 700 }}>Recent Invoices</span>
            <span style={{ fontSize: 12, color: "#ff6b00", fontWeight: 700, cursor: "pointer" }} onClick={() => navigate("invoices")}>View All →</span>
          </div>
          {d.recentInvoices.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#a39b8e", fontSize: 14 }}>Koi invoice nahi — bill scan karo!</div>
          ) : d.recentInvoices.map((inv) => {
            const statusColors: any = { matched: "#16a34a", pending: "#b45309", unmatched: "#dc2626" };
            const statusBgs: any = { matched: "#dcfce7", pending: "#fef3c7", unmatched: "#fee2e2" };
            const isSale = inv.type === "sale";
            return (
              <div key={inv.id} className="inv-row" onClick={() => navigate("invoices")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{inv.invoice_number}</span>
                  <span style={{ fontSize: 12, color: "#6b6457" }}>{inv.party_name}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: isSale ? "#dcfce7" : "#dbeafe", color: isSale ? "#16a34a" : "#1d4ed8" }}>{isSale ? "↑ Sale" : "↓ Buy"}</span>
                  <span style={{ fontSize: 10, color: "#a39b8e" }}>{formatDate(inv.invoice_date)}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: isSale ? "#16a34a" : "#1a1611" }}>{formatRupees(inv.total_amount)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, color: statusColors[inv.gst_status], background: statusBgs[inv.gst_status] }}>{inv.gst_status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}