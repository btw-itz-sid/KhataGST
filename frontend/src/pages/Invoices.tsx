import { useEffect, useMemo, useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

type Route = "login" | "dashboard" | "scan" | "invoices";
type Tab = "all" | "sale" | "purchase";
type SortKey = "date" | "amount" | "party";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: "sale" | "purchase";
  party_name: string;
  party_gstin?: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  gst_status: "matched" | "pending" | "unmatched";
}

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

interface Props {
  navigate: (route: Route) => void;
}

const BASE_URL = "/api/v1";

const MOCK: Invoice[] = [
  {
    id: "1",
    invoice_number: "INV-001",
    invoice_date: "2026-03-15",
    invoice_type: "sale",
    party_name: "Ramesh Traders",
    party_gstin: "27AABCU9603R1ZX",
    taxable_amount: 1000000,
    cgst_amount: 90000,
    sgst_amount: 90000,
    igst_amount: 0,
    total_amount: 1180000,
    gst_status: "matched",
  },
  {
    id: "2",
    invoice_number: "PUR-001",
    invoice_date: "2026-03-18",
    invoice_type: "purchase",
    party_name: "Suresh Wholesale",
    taxable_amount: 500000,
    cgst_amount: 45000,
    sgst_amount: 45000,
    igst_amount: 0,
    total_amount: 590000,
    gst_status: "pending",
  },
  {
    id: "3",
    invoice_number: "INV-002",
    invoice_date: "2026-03-20",
    invoice_type: "sale",
    party_name: "Priya Enterprises",
    taxable_amount: 2500000,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 450000,
    total_amount: 2950000,
    gst_status: "matched",
  },
  {
    id: "4",
    invoice_number: "PUR-002",
    invoice_date: "2026-03-10",
    invoice_type: "purchase",
    party_name: "Delhi Supplies Co.",
    taxable_amount: 750000,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 135000,
    total_amount: 885000,
    gst_status: "unmatched",
  },
];

function formatMoney(paise: number): string {
  const rupees = paise / 100;

  if (rupees >= 100000) return `INR ${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `INR ${(rupees / 1000).toFixed(1)}K`;

  return `INR ${rupees.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function normalizeInvoice(invoice: RawInvoice): Invoice {
  return {
    id: String(invoice.id ?? ""),
    invoice_number: String(invoice.invoice_number ?? "NA"),
    invoice_date: String(invoice.invoice_date ?? new Date().toISOString()),
    invoice_type: invoice.invoice_type === "purchase" ? "purchase" : "sale",
    party_name: String(
      invoice.party_name ?? invoice.party_gstin ?? "Unknown party"
    ),
    party_gstin: invoice.party_gstin ?? undefined,
    taxable_amount: Number(invoice.taxable_value ?? invoice.taxable_amount ?? 0),
    cgst_amount: Number(invoice.cgst_amount ?? 0),
    sgst_amount: Number(invoice.sgst_amount ?? 0),
    igst_amount: Number(invoice.igst_amount ?? 0),
    total_amount: Number(invoice.total_amount ?? 0),
    gst_status:
      invoice.gst_status === "matched" || invoice.gst_status === "unmatched"
        ? invoice.gst_status
        : "pending",
  };
}

export default function Invoices({ navigate }: Props) {
  const storedToken = getToken();
  const storedBusiness = getBusinessContext();
  const canFetchLiveData = Boolean(storedToken && storedBusiness?.id);

  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    canFetchLiveData ? [] : MOCK
  );
  const [loading, setLoading] = useState(canFetchLiveData);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [selected, setSelected] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!canFetchLiveData || !storedBusiness?.id) return;

    fetch(`${BASE_URL}/invoices?business_id=${storedBusiness.id}`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Invoice fetch failed");

        const rows: RawInvoice[] = Array.isArray(
          payload?.invoices ?? payload?.data
        )
          ? (payload?.invoices ?? payload?.data)
          : [];
        setInvoices(rows.length ? rows.map(normalizeInvoice) : []);
      })
      .catch(() => setInvoices(MOCK))
      .finally(() => setLoading(false));
  }, [canFetchLiveData, storedBusiness?.id, storedToken]);

  const filtered = useMemo(() => {
    let list = invoices;

    if (tab !== "all") {
      list = list.filter((invoice) => invoice.invoice_type === tab);
    }

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((invoice) => {
        return (
          invoice.invoice_number.toLowerCase().includes(query) ||
          invoice.party_name.toLowerCase().includes(query) ||
          (invoice.party_gstin || "").toLowerCase().includes(query)
        );
      });
    }

    return [...list].sort((left, right) => {
      if (sortBy === "amount") return right.total_amount - left.total_amount;
      if (sortBy === "party") return left.party_name.localeCompare(right.party_name);
      return (
        new Date(right.invoice_date).getTime() -
        new Date(left.invoice_date).getTime()
      );
    });
  }, [invoices, tab, search, sortBy]);

  const statusColor: Record<Invoice["gst_status"], string> = {
    matched: "#16a34a",
    pending: "#b45309",
    unmatched: "#dc2626",
  };

  const statusBg: Record<Invoice["gst_status"], string> = {
    matched: "#dcfce7",
    pending: "#fef3c7",
    unmatched: "#fee2e2",
  };

  if (selected) {
    return (
      <>
        <style>{STYLES}</style>
        <nav className="topbar">
          <button className="back-btn" onClick={() => setSelected(null)}>
            Back
          </button>
          <div className="logo">Invoice</div>
          <div style={{ width: 60 }} />
        </nav>

        <div className="content">
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#a39b8e",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  Invoice Number
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {selected.invoice_number}
                </div>
              </div>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 20,
                  color: statusColor[selected.gst_status],
                  background: statusBg[selected.gst_status],
                  textTransform: "uppercase",
                  alignSelf: "flex-start",
                }}
              >
                {selected.gst_status}
              </span>
            </div>

            {(
              [
                ["Party", selected.party_name],
                ...(selected.party_gstin
                  ? ([["GSTIN", selected.party_gstin]] as Array<[string, string]>)
                  : []),
                ["Date", formatDate(selected.invoice_date)],
                ["Type", selected.invoice_type === "sale" ? "Sale" : "Purchase"],
              ] as Array<[string, string]>
            ).map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "9px 0",
                    borderBottom: "1px solid #e5e1d8",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6b6457",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
                </div>
              ))}

            <div style={{ borderTop: "1px solid #e5e1d8", marginTop: 8, paddingTop: 8 }}>
              {(
                [
                  ["Taxable Amount", formatMoney(selected.taxable_amount)],
                  ...(selected.igst_amount > 0
                    ? ([["IGST", formatMoney(selected.igst_amount)]] as Array<[string, string]>)
                    : []),
                  ...(selected.cgst_amount > 0
                    ? ([["CGST", formatMoney(selected.cgst_amount)]] as Array<[string, string]>)
                    : []),
                  ...(selected.sgst_amount > 0
                    ? ([["SGST", formatMoney(selected.sgst_amount)]] as Array<[string, string]>)
                    : []),
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "7px 0",
                      borderBottom: "1px solid #e5e1d8",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#6b6457" }}>{label}</span>
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {value}
                    </span>
                  </div>
                ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                }}
              >
                <span style={{ fontWeight: 700 }}>Grand Total</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 18,
                    color: "#ff6b00",
                  }}
                >
                  {formatMoney(selected.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <nav className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          Home
        </button>
        <div className="logo">Invoices</div>
        <button className="new-btn" onClick={() => navigate("scan")}>
          + New
        </button>
      </nav>

      <div className="content">
        <div className="search-wrap">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#a39b8e" }}>
            FIND
          </span>
          <input
            className="search-input"
            placeholder="Party, invoice no, GSTIN..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none",
                border: "none",
                color: "#a39b8e",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              X
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, flex: 1 }}>
            {(["all", "sale", "purchase"] as Tab[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  border: `1.5px solid ${tab === item ? "#ff6b00" : "#e5e1d8"}`,
                  borderRadius: 8,
                  background: tab === item ? "#fff3e8" : "#fff",
                  color: tab === item ? "#ff6b00" : "#6b6457",
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {item === "all" ? "All" : item === "sale" ? "Sales" : "Purchases"}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortKey)}
            style={{
              border: "1.5px solid #e5e1d8",
              borderRadius: 8,
              background: "#fff",
              padding: "7px 9px",
              fontFamily: "'Sora', sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "#6b6457",
              outline: "none",
            }}
          >
            <option value="date">Latest</option>
            <option value="amount">Amount</option>
            <option value="party">Party A-Z</option>
          </select>
        </div>

        {!search && tab === "all" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#fff",
              border: "1px solid #e5e1d8",
              borderRadius: 12,
              padding: "11px 14px",
              marginBottom: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#a39b8e", fontWeight: 600 }}>
                Sales ({invoices.filter((invoice) => invoice.invoice_type === "sale").length})
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#16a34a",
                }}
              >
                {formatMoney(
                  invoices
                    .filter((invoice) => invoice.invoice_type === "sale")
                    .reduce((sum, invoice) => sum + invoice.total_amount, 0)
                )}
              </div>
            </div>

            <div
              style={{
                width: 1,
                background: "#e5e1d8",
                alignSelf: "stretch",
                margin: "0 14px",
              }}
            />

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <div style={{ fontSize: 11, color: "#a39b8e", fontWeight: 600 }}>
                Purchases (
                {invoices.filter((invoice) => invoice.invoice_type === "purchase").length})
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
                {formatMoney(
                  invoices
                    .filter((invoice) => invoice.invoice_type === "purchase")
                    .reduce((sum, invoice) => sum + invoice.total_amount, 0)
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#6b6457" }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {search ? "Koi result nahi" : "Koi invoice nahi"}
            </div>
            <div style={{ fontSize: 12, color: "#6b6457" }}>
              {search ? `"${search}" ke liye kuch nahi mila` : "Pehla bill scan karo"}
            </div>
            {!search && (
              <button
                onClick={() => navigate("scan")}
                style={{
                  marginTop: 14,
                  padding: "12px 20px",
                  background: "#ff6b00",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Scan Karo
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "#a39b8e", fontWeight: 600, marginBottom: 4 }}>
              {filtered.length} invoice{filtered.length !== 1 ? "s" : ""}
            </div>

            {filtered.map((invoice) => {
              const isSale = invoice.invoice_type === "sale";

              return (
                <div
                  key={invoice.id}
                  className="inv-card"
                  onClick={() => setSelected(invoice)}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: isSale ? "#dcfce7" : "#dbeafe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: isSale ? "#16a34a" : "#1d4ed8",
                      flexShrink: 0,
                    }}
                  >
                    {isSale ? "SAL" : "PUR"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                        {invoice.invoice_number}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 20,
                          color: statusColor[invoice.gst_status],
                          background: statusBg[invoice.gst_status],
                          textTransform: "uppercase",
                        }}
                      >
                        {invoice.gst_status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b6457" }}>{invoice.party_name}</div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 13,
                        fontWeight: 700,
                        color: isSale ? "#16a34a" : "#1a1611",
                      }}
                    >
                      {formatMoney(invoice.total_amount)}
                    </span>
                    <span style={{ fontSize: 11, color: "#a39b8e" }}>
                      {formatDate(invoice.invoice_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
  
  /* Animations */
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
  .content, .card { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .inv-card { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; animation-fill-mode: both; }
  .inv-card:nth-child(2) { animation-delay: 0.05s; }
  .inv-card:nth-child(3) { animation-delay: 0.1s; }
  .inv-card:nth-child(4) { animation-delay: 0.15s; }
  .inv-card:nth-child(5) { animation-delay: 0.2s; }
  .inv-card:nth-child(6) { animation-delay: 0.25s; }

  body { background: #f8fafc; font-family: 'Sora', sans-serif; color: #0f172a; margin: 0; }
  
  /* Premium Header */
  .topbar { background: rgba(15,23,42,.88); backdrop-filter: blur(16px); height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(255,255,255,.05); }
  .logo { font-family: 'Space Mono', monospace; font-size: 16px; color: #fff; font-weight: 700; letter-spacing: -0.02em; }
  .back-btn { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.05); color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-family: 'Sora', sans-serif; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
  .back-btn:hover { background: rgba(255,255,255,.15); transform: translateY(-1px); }
  .new-btn { background: linear-gradient(135deg, #ff7a1a, #ea580c); border: none; color: #fff; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-family: 'Sora', sans-serif; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(234,88,12,.25); transition: all 0.2s ease; }
  .new-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(234,88,12,.35); }
  
  .content { max-width: 680px; margin: 0 auto; padding: 24px 16px 80px; }
  
  /* Refined Controls */
  .search-wrap { display: flex; align-items: center; gap: 12px; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 0 16px; margin-bottom: 16px; transition: border-color 0.2s; box-shadow: 0 4px 12px rgba(15,23,42,.02); }
  .search-wrap:focus-within { border-color: #ff6b00; box-shadow: 0 0 0 3px rgba(255,107,0,.08); }
  .search-input { flex: 1; border: none; background: transparent; padding: 14px 0; font-family: 'Sora', sans-serif; font-size: 14px; color: #0f172a; outline: none; font-weight: 600; }
  .search-input::placeholder { color: #94a3b8; font-weight: 400; }
  
  /* Detail View Card */
  .card { background: #fff; border-radius: 20px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15,23,42,.04); }
  
  /* Invoice List Item */
  .inv-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px; padding: 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 2px 8px rgba(15,23,42,.02); }
  .inv-card:hover { border-color: #cbd5e1; box-shadow: 0 8px 24px rgba(15,23,42,.06); transform: translateY(-2px); }

  @media (max-width: 640px) {
    .content { padding: 16px 14px 84px; }
    .topbar { padding: 0 12px; height: 52px; }
    .card { padding: 16px; border-radius: 16px; }
    .inv-card { padding: 12px 14px; gap: 10px; }
    
    /* Stack the filter tabs and select dropdown */
    div[style*="marginBottom: 12"] { flex-direction: column; align-items: stretch !important; gap: 12px !important; }
    select { width: 100%; }
  }
`;
