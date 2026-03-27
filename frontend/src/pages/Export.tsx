import { useState } from "react";
import { getBusinessContext, getToken } from "../lib/session";

type ExportType = "excel" | "csv";

interface Props {
  navigate: (route: "dashboard") => void;
}

interface StatusMessage {
  tone: "success" | "error";
  text: string;
}

interface DownloadOption {
  type: ExportType;
  code: string;
  title: string;
  subtitle: string;
  accent: string;
  surface: string;
  badge?: string;
  details: string[];
  buttonLabel: string;
  fileType: string;
}

const BASE_URL = "/api/v1";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - 2 + index);

const DOWNLOAD_OPTIONS: DownloadOption[] = [
  {
    type: "excel",
    code: "XLSX",
    title: "Portal Workbook",
    subtitle: "Best for GST filing review and direct submission preparation.",
    accent: "#ff6b00",
    surface: "#fff3e8",
    badge: "Recommended",
    details: [
      "Structured for GSTR-1 style workbook review",
      "Includes summary, B2B, and B2C views",
      "Best choice when founders file on their own",
    ],
    buttonLabel: "Download Excel",
    fileType: ".xlsx",
  },
  {
    type: "csv",
    code: "CSV",
    title: "Raw Accountant Export",
    subtitle: "A clean row-level file for CAs, accountants, and reconciliation.",
    accent: "#2563eb",
    surface: "#eff6ff",
    details: [
      "Simple flat-file structure for audits and imports",
      "Useful for finance teams who work in spreadsheets",
      "Easy to share when external filing support is involved",
    ],
    buttonLabel: "Download CSV",
    fileType: ".csv",
  },
];

const PREP_ITEMS = [
  {
    title: "Review taxable totals",
    text: "Confirm invoice values are final before generating the workbook you plan to file from.",
  },
  {
    title: "Check invoice dates",
    text: "Exports are period-bound, so late or back-dated entries can affect the filing month.",
  },
  {
    title: "Share the right file",
    text: "Use Excel for direct filing prep and CSV when your CA wants raw structured rows.",
  },
];

export default function Export({ navigate }: Props) {
  const [month, setMonth] = useState(CURRENT_DATE.getMonth());
  const [year, setYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const business = getBusinessContext();
  const token = getToken();
  const businessName = business?.name || "Current business";
  const selectedPeriodLabel = `${MONTHS[month]} ${year}`;
  const periodCode = `${String(month + 1).padStart(2, "0")}${year}`;
  const taxPeriod = `${year}-${String(month + 1).padStart(2, "0")}`;

  async function download(type: ExportType) {
    if (!token || !business?.id) {
      setStatus({
        tone: "error",
        text: "Business session missing. Return to dashboard and sign in again before exporting.",
      });
      return;
    }

    setLoading(type);
    setStatus(null);

    try {
      const response = await fetch(
        `${BASE_URL}/export/${type}?business_id=${business.id}&tax_period=${taxPeriod}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const extension = type === "excel" ? "xlsx" : "csv";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `KhataGST_${MONTHS[month]}_${year}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setStatus({
        tone: "success",
        text: `${type === "excel" ? "Excel workbook" : "CSV export"} download started for ${selectedPeriodLabel}.`,
      });
    } catch {
      setStatus({
        tone: "error",
        text: "Export failed. Confirm the backend is running and try again.",
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      <nav className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          Dashboard
        </button>
        <div className="logo">
          Khata<span>GST</span>
        </div>
        <div className="topbar-meta">GSTR-1 Export</div>
      </nav>

      <div className="content export-page">
        <section className="hero-card">
          <div className="hero-glow hero-glow-a" />
          <div className="hero-glow hero-glow-b" />

          <div className="hero-main">
            <div className="section-tag">Compliance Export</div>
            <h1 className="hero-title">
              Export filing-ready data for {selectedPeriodLabel}
            </h1>
            <p className="hero-copy">
              Generate a clean workbook for portal preparation or a raw CSV for
              your accountant. This export is scoped to period code {periodCode}
              {" "}for {businessName}.
            </p>

            <div className="hero-pill-row">
              <span className="hero-pill hero-pill-accent">{businessName}</span>
              <span className="hero-pill">Period {periodCode}</span>
              <span className="hero-pill">2 professional formats</span>
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-metric">
              <span>Target filing</span>
              <strong>GSTR-1 package</strong>
            </div>
            <div className="hero-metric">
              <span>Coverage</span>
              <strong>Summary, B2B, B2C</strong>
            </div>
            <div className="hero-metric">
              <span>Delivery</span>
              <strong>Direct browser download</strong>
            </div>
          </div>
        </section>

        {status && (
          <div className={`notice ${status.tone}`}>
            {status.text}
          </div>
        )}

        <div className="control-grid">
          <section className="card">
            <div className="card-label">Select Period</div>

            <div className="field-grid">
              <label className="field">
                <span>Month</span>
                <select
                  className="select-input"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {MONTHS.map((item, index) => (
                    <option key={item} value={index}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Year</span>
                <select
                  className="select-input"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {YEAR_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="period-panel">
              <div>
                <div className="period-title">{selectedPeriodLabel}</div>
                <div className="period-subtitle">
                  This filing code is attached to both export formats so your
                  team and accountant stay aligned on the same period.
                </div>
              </div>

              <div className="period-code">{periodCode}</div>
            </div>
          </section>

          <aside className="card card-muted">
            <div className="card-label">Included In Package</div>

            <div className="info-list">
              <div className="info-row">
                <strong>Workbook tabs</strong>
                <span>Summary, B2B, and B2C views for filing review</span>
              </div>
              <div className="info-row">
                <strong>Period mapping</strong>
                <span>Month and year converted to filing code {periodCode}</span>
              </div>
              <div className="info-row">
                <strong>Business scope</strong>
                <span>Export generated for {businessName}</span>
              </div>
            </div>
          </aside>
        </div>

        <section className="formats-section">
          <div className="formats-head">
            <div>
              <div className="section-tag section-tag-dark">Download Formats</div>
              <h2 className="formats-title">
                Choose the file your workflow needs
              </h2>
            </div>

            <p className="formats-copy">
              Excel is best for direct portal preparation. CSV works better when
              a CA or finance team wants raw structured rows.
            </p>
          </div>

          <div className="format-grid">
            {DOWNLOAD_OPTIONS.map((option) => {
              const isLoading = loading === option.type;
              const isDisabled = loading !== null;

              return (
                <article className="format-card" key={option.type}>
                  <div
                    className="format-accent"
                    style={{ background: option.accent }}
                  />

                  <div className="format-top">
                    <span
                      className="format-code"
                      style={{
                        color: option.accent,
                        background: option.surface,
                      }}
                    >
                      {option.code}
                    </span>

                    {option.badge && (
                      <span className="format-badge">{option.badge}</span>
                    )}
                  </div>

                  <h3 className="format-title">{option.title}</h3>
                  <p className="format-subtitle">{option.subtitle}</p>

                  <div className="feature-list">
                    {option.details.map((detail) => (
                      <div className="feature-row" key={detail}>
                        <span
                          className="feature-dot"
                          style={{ background: option.accent }}
                        />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>

                  <div className="format-footer">
                    <div className="format-meta">
                      <span>File type</span>
                      <strong>{option.fileType}</strong>
                    </div>

                    <button
                      className="download-btn"
                      style={{
                        background: option.accent,
                        boxShadow: `0 10px 24px ${option.accent}33`,
                      }}
                      disabled={isDisabled}
                      onClick={() => download(option.type)}
                    >
                      {isLoading ? "Preparing..." : option.buttonLabel}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="card prep-card">
          <div className="card-label">Before You File</div>

          <div className="prep-grid">
            {PREP_ITEMS.map((item) => (
              <div className="prep-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap');

  body {
    margin: 0;
    background: #f8fafc;
    font-family: 'Sora', sans-serif;
    color: #1a1611;
  }

  .topbar { background: rgba(15,23,42,.88); backdrop-filter: blur(16px); height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(255,255,255,.05); }
  .logo { font-family: 'Space Mono', monospace; font-size: 16px; color: #fff; font-weight: 700; letter-spacing: -0.02em; }
  .logo span { color: #ff6b00; }
  
  .back-btn { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.05); color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-family: 'Sora', sans-serif; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
  .back-btn:hover { background: rgba(255,255,255,.15); transform: translateY(-1px); }
  
  .topbar-meta { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #8a94a6; }

  .content {
    max-width: 860px;
    margin: 0 auto;
    padding: 32px 18px 100px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    animation: rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .export-page {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .hero-card {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
    gap: 18px;
    padding: 28px;
    border-radius: 22px;
    background: linear-gradient(135deg, #1a1611 0%, #2a2018 58%, #65320d 100%);
    color: #fff;
    box-shadow: 0 18px 44px rgba(26, 22, 17, 0.16);
    animation: rise 0.45s ease both;
  }

  .hero-glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(18px);
    opacity: 0.52;
    pointer-events: none;
    animation: float 6s ease-in-out infinite;
  }

  .hero-glow-a {
    width: 180px;
    height: 180px;
    top: -48px;
    right: 104px;
    background: rgba(255, 107, 0, 0.32);
  }

  .hero-glow-b {
    width: 140px;
    height: 140px;
    bottom: -54px;
    right: -20px;
    background: rgba(255, 255, 255, 0.12);
    animation-delay: -2s;
  }

  .hero-main,
  .hero-side {
    position: relative;
    z-index: 1;
  }

  .section-tag {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.62);
    margin-bottom: 10px;
  }

  .section-tag-dark {
    color: #a39b8e;
  }

  .hero-title {
    margin: 0 0 12px;
    max-width: 12ch;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.05;
    font-weight: 800;
  }

  .hero-copy {
    max-width: 60ch;
    margin: 0 0 18px;
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.78);
  }

  .hero-pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hero-pill {
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .hero-pill-accent {
    background: #fff3e8;
    border-color: transparent;
    color: #ff6b00;
  }

  .hero-side {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .hero-metric {
    padding: 16px 16px 15px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(6px);
  }

  .hero-metric span {
    display: block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.54);
  }

  .hero-metric strong {
    font-size: 16px;
    line-height: 1.35;
    font-weight: 700;
    color: #fff;
  }

  .notice {
    border-radius: 14px;
    padding: 14px 16px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    animation: rise 0.35s ease both;
  }

  .notice.success {
    background: #ecfdf3;
    border-color: #86efac;
    color: #166534;
  }

  .notice.error {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #b91c1c;
  }

  .control-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 14px;
  }

  .card {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e5e1d8;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 10px 26px rgba(26, 22, 17, 0.05);
  }

  .card-muted {
    background: linear-gradient(180deg, #fffdfa 0%, #faf7f1 100%);
  }

  .card-label {
    margin-bottom: 14px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #a39b8e;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field span {
    font-size: 12px;
    font-weight: 700;
    color: #6b6457;
  }

  .select-input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1.5px solid #e5e1d8;
    background: #fff;
    color: #1a1611;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }

  .select-input:focus {
    border-color: #ff6b00;
    box-shadow: 0 0 0 4px rgba(255, 107, 0, 0.08);
  }

  .period-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
    border-radius: 16px;
    background: linear-gradient(135deg, #1a1611 0%, #31261e 100%);
    color: #fff;
  }

  .period-title {
    margin-bottom: 6px;
    font-size: 20px;
    font-weight: 700;
  }

  .period-subtitle {
    max-width: 46ch;
    font-size: 12px;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.68);
  }

  .period-code {
    flex-shrink: 0;
    font-family: 'Space Mono', monospace;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #ffb072;
  }

  .info-list {
    display: grid;
    gap: 12px;
  }

  .info-row {
    display: grid;
    gap: 4px;
    padding: 14px 14px 13px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid #ede7dc;
  }

  .info-row strong {
    font-size: 13px;
    font-weight: 700;
    color: #1a1611;
  }

  .info-row span {
    font-size: 12px;
    line-height: 1.6;
    color: #6b6457;
  }

  .formats-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .formats-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
  }

  .formats-title {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.15;
    color: #1a1611;
  }

  .formats-copy {
    max-width: 440px;
    margin: 0;
    font-size: 13px;
    line-height: 1.65;
    color: #6b6457;
  }

  .format-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .format-card {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #e5e1d8;
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 12px 28px rgba(26, 22, 17, 0.05);
    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
    animation: rise 0.45s ease both;
  }

  .format-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px rgba(26, 22, 17, 0.08);
    border-color: #d8d0c4;
  }

  .format-accent {
    height: 4px;
    border-radius: 999px;
    margin: -20px -20px 18px;
  }

  .format-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }

  .format-code {
    display: inline-flex;
    align-items: center;
    padding: 7px 11px;
    border-radius: 999px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
  }

  .format-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #fff3e8;
    color: #ff6b00;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .format-title {
    margin: 0 0 8px;
    font-size: 21px;
    font-weight: 800;
    color: #1a1611;
  }

  .format-subtitle {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: #6b6457;
  }

  .feature-list {
    display: grid;
    gap: 10px;
    margin: 18px 0 20px;
  }

  .feature-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    line-height: 1.6;
    color: #4a443d;
  }

  .feature-dot {
    width: 8px;
    height: 8px;
    margin-top: 6px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .format-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .format-meta {
    display: grid;
    gap: 4px;
  }

  .format-meta span {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #a39b8e;
  }

  .format-meta strong {
    font-size: 14px;
    font-family: 'Space Mono', monospace;
    color: #1a1611;
  }

  .download-btn {
    min-width: 156px;
    border: none;
    border-radius: 12px;
    padding: 12px 16px;
    color: #fff;
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
  }

  .download-btn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .download-btn:disabled {
    cursor: not-allowed;
    opacity: 0.72;
  }

  .prep-card {
    padding-bottom: 22px;
  }

  .prep-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .prep-item {
    display: grid;
    gap: 6px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid #e9e3d8;
    background: #fbfaf7;
  }

  .prep-item strong {
    font-size: 14px;
    font-weight: 700;
    color: #1a1611;
  }

  .prep-item span {
    font-size: 12px;
    line-height: 1.65;
    color: #6b6457;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(0, 12px, 0);
    }
  }

  @media (max-width: 820px) {
    .hero-card,
    .control-grid,
    .format-grid,
    .prep-grid {
      grid-template-columns: 1fr;
    }

    .formats-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .formats-copy {
      max-width: none;
    }
  }

  @media (max-width: 640px) {
    .topbar {
      padding: 0 12px;
    }

    .topbar-meta {
      display: none;
    }

    .content {
      padding: 18px 12px 84px;
    }

    .hero-card {
      padding: 22px 18px;
      border-radius: 18px;
    }

    .hero-title {
      max-width: none;
      font-size: 30px;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }

    .period-panel,
    .format-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .period-code,
    .download-btn {
      width: 100%;
    }

    .download-btn {
      min-width: 0;
    }
  }
`;
