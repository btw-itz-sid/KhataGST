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

function normalizeInvoice(invoice: any): Invoice {
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [selected, setSelected] = useState<Invoice | null>(null);

  useEffect(() => {
    const token = getToken();
    const business = getBusinessContext();

    if (!token || !business?.id) {
      setInvoices(MOCK);
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/invoices?business_id=${business.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Invoice fetch failed");

        const rows = payload?.invoices ?? payload?.data ?? [];
        setInvoices(rows.length ? rows.map(normalizeInvoice) : []);
      })
      .catch(() => setInvoices(MOCK))
      .finally(() => setLoading(false));
  }, []);

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

            {[
              ["Party", selected.party_name],
              selected.party_gstin ? ["GSTIN", selected.party_gstin] : null,
              ["Date", formatDate(selected.invoice_date)],
              ["Type", selected.invoice_type === "sale" ? "Sale" : "Purchase"],
            ]
              .filter(Boolean)
              .map(([label, value]: any) => (
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
              {[
                ["Taxable Amount", formatMoney(selected.taxable_amount)],
                selected.igst_amount > 0 ? ["IGST", formatMoney(selected.igst_amount)] : null,
                selected.cgst_amount > 0 ? ["CGST", formatMoney(selected.cgst_amount)] : null,
                selected.sgst_amount > 0 ? ["SGST", formatMoney(selected.sgst_amount)] : null,
              ]
                .filter(Boolean)
                .map(([label, value]: any) => (
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
  body { background: #f5f3ef; font-family: 'Sora', sans-serif; color: #1a1611; }
  .topbar { background: #1a1611; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; position: sticky; top: 0; z-index: 100; }
  .logo { font-family: 'Space Mono', monospace; font-size: 15px; color: #fff; font-weight: 700; }
  .back-btn { background: rgba(255,255,255,.12); border: none; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-family: 'Sora', sans-serif; cursor: pointer; }
  .new-btn { background: #ff6b00; border: none; color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-family: 'Sora', sans-serif; font-weight: 700; cursor: pointer; }
  .content { max-width: 640px; margin: 0 auto; padding: 16px 14px 80px; }
  .search-wrap { display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid #e5e1d8; border-radius: 10px; padding: 0 14px; margin-bottom: 12px; }
  .search-input { flex: 1; border: none; background: transparent; padding: 11px 0; font-family: 'Sora', sans-serif; font-size: 13px; color: #1a1611; outline: none; }
  .search-input::placeholder { color: #a39b8e; }
  .card { background: #fff; border-radius: 12px; padding: 18px; border: 1px solid #e5e1d8; }
  .inv-card { background: #fff; border-radius: 12px; border: 1px solid #e5e1d8; display: flex; align-items: center; gap: 12px; padding: 13px 14px; cursor: pointer; transition: box-shadow .15s, transform .15s; }
  .inv-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); transform: translateY(-1px); }
`;
