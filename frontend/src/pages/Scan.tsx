import "./Scan.css";
// ─────────────────────────────────────────────────────────────────────────────
// Scan.tsx — AI Invoice Scanner Page
// User yahan apna GST bill upload karta hai
// Gemini AI bill scan karta hai aur saare fields extract karta hai
// Phir user verify karke invoice save kar sakta hai
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { apiFetch, getApiErrorMessage } from "../lib/api";
import { getBusinessContext } from "../lib/session";

// Route type — navigate ke liye
type Route = "login" | "dashboard" | "scan" | "invoices" | "export";

// Props — parent se navigate milta hai
interface Props {
  navigate: (route: Route) => void;
}

// Scan se extract hone wala data ka structure
interface ItcDecision {
  itcEligibility: "eligible" | "blocked" | "rcm_applicable";
  blockedSection?: string;
  explanation: string;
  statutoryReference?: string;
  claimablePaise: number;
  blockedPaise: number;
  taxAmountPaise?: number;
}

interface ScanLine {
  description: string;
  hsn_sac: string;
  quantity: number;
  unit_price_paise: number;
  gst_rate: number;
  taxable_amount: number;
  itc?: ItcDecision;
}

interface ScannedInvoiceData {
  invoice_number: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_date: string;
  taxable_amount: number;   // paise mein
  gst_rate: number;         // percentage: 5, 12, 18, 28
  cgst_amount: number;      // paise mein
  sgst_amount: number;      // paise mein
  igst_amount: number;      // paise mein
  total_amount: number;     // paise mein
  hsn_code: string;
  item_description: string;
  items: ScanLine[];
  confidence: number;       // 0-100
  action: "auto" | "review" | "manual";
  itc: ItcDecision | null;
}

type ScanStep = "upload" | "scanning" | "review" | "saving" | "done";

function normalizeScanLines(ext: any, itc: ItcDecision | null): ScanLine[] {
  const fromItc = Array.isArray((itc as any)?.lines) ? (itc as any).lines : [];
  const fromExt = Array.isArray(ext?.items) ? ext.items : [];
  const source = fromItc.length > 0 ? fromItc : fromExt;
  if (source.length === 0 && Number(ext?.taxable_amount || 0) > 0) {
    return [{
      description: ext.item_description || "Purchase",
      hsn_sac: ext.hsn_code || "",
      quantity: 1,
      unit_price_paise: Number(ext.taxable_amount || 0),
      gst_rate: Number(ext.gst_rate || 18),
      taxable_amount: Number(ext.taxable_amount || 0),
      itc: itc || undefined,
    }];
  }
  return source.map((item: any) => ({
    description: String(item.description || item.item_description || "Purchase"),
    hsn_sac: String(item.hsn_sac || item.hsn_code || ""),
    quantity: Number(item.quantity || 1),
    unit_price_paise: Number(item.unit_price_paise || item.unit_price || item.taxable_amount || 0),
    gst_rate: Number(item.gst_rate || ext?.gst_rate || 18),
    taxable_amount: Number(item.taxable_amount || item.taxable_value || 0),
    itc: item.itc || undefined,
  }));
}

// ── Khali invoice template — review form ke liye ───────────────────────────
const EMPTY_INVOICE: ScannedInvoiceData = {
  invoice_number: "",
  vendor_name: "",
  vendor_gstin: "",
  invoice_date: new Date().toISOString().split("T")[0],
  taxable_amount: 0,
  gst_rate: 18,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 0,
  total_amount: 0,
  hsn_code: "",
  item_description: "",
  items: [],
  confidence: 0,
  action: "manual",
  itc: null,
};

// ── Helper: Paise ko display ke liye INR string mein convert karo ──────────
function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Helper: Rupee input value ko paise mein convert karo ───────────────────
function parseAmountInput(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const rupees = Number(normalized);
  return Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
}

// ── Helper: Paise ko input field ke liye readable format mein do ───────────
function formatAmountInput(paise: number): string {
  if (!paise) return "";
  return (paise / 100).toFixed(2);
}

// ── Helper: Confidence score ke hisaab se tone decide karo ────────────────
function getConfidenceTone(c: number): { label: string; cls: string } {
  if (c >= 85) return { label: `${c}% — High confidence`, cls: "conf-high" };
  if (c >= 65) return { label: `${c}% — Review recommended`, cls: "conf-mid" };
  return { label: `${c}% — Manual check advised`, cls: "conf-low" };
}

// ── Helper: Error message ko user-friendly banao ───────────────────────────
function getScanErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Scan fail hua. Dobara try karo.";
  const msg = err.message.toLowerCase();
  if (msg.includes("429") || msg.includes("quota"))
    return "AI scan busy hai. Thodi der baad try karo.";
  if (msg.includes("network") || msg.includes("fetch failed"))
    return "Network error. Internet check karo aur dobara try karo.";
  if (msg.includes("api key"))
    return "AI scan setup nahi hai. Admin se contact karo.";
  return `Scan fail hua: ${err.message}`;
}

// ── Helper: Kya ye hard failure hai (retry nahi ho sakta) ─────────────────
function isHardFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("429") || msg.includes("quota") ||
    msg.includes("network") || msg.includes("fetch failed") ||
    msg.includes("econnreset") || msg.includes("api key")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Scan Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Scan({ navigate }: Props) {
  // Scan flow ka current step
  const [step, setStep] = useState<ScanStep>("upload");

  // Image preview aur file state
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Extracted/edited invoice data
  const [edited, setEdited] = useState<ScannedInvoiceData | null>(null);

  // Error aur notice messages
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // File input refs — file picker aur camera
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  // Business info session se
  const businessName = getBusinessContext()?.name || "your business";

  // ── File select hone pe preview banao ─────────────────────────────────
  function handleFile(nextFile: File) {
    const isPdf = nextFile.type === "application/pdf" || nextFile.name.toLowerCase().endsWith(".pdf");
    const isImage = nextFile.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("JPG, PNG, WEBP ya PDF upload karo.");
      return;
    }
    setFile(nextFile);
    setError(null);
    setNotice(null);

    if (isPdf) {
      setPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(nextFile);
  }

  // ── Scan API call karo ─────────────────────────────────────────────────
  async function scanBill() {
    if (!file) return;

    const business = getBusinessContext();

    if (!business?.id) {
      setError("Session expire ho gayi. Dashboard pe jao aur dobara sign in karo.");
      return;
    }

    // Scanning state mein jao
    setStep("scanning");
    setError(null);
    setNotice(null);

    try {
      // FormData mein file aur business_id bhejo
      const formData = new FormData();
      formData.append("business_id", business.id);
      formData.append("bill", file);

      const response = await apiFetch("/scans", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Invoice scan fail hua."));
      }

      // Response se extracted data nikalo
      const scan = payload?.scan ?? payload?.data ?? null;
      if (!scan) throw new Error("Scan response incomplete hai.");

      const ext = scan.extracted_data ?? scan;
      const itc = (scan.itc ?? ext.itc ?? null) as ItcDecision | null;

      if (Number(scan.confidence_score ?? ext.confidence ?? 0) < 65) {
        setNotice("AI confidence kam hai. Fields manually verify kar lo.");
      }
      if (itc?.itcEligibility === "blocked") {
        setNotice("Section 17(5): is purchase ka ITC blocked ho sakta hai. Claim mat karo.");
      }

      const lines = normalizeScanLines(ext, itc);
      setEdited({
        invoice_number: ext.invoice_number || "",
        vendor_name: ext.vendor_name || "",
        vendor_gstin: ext.vendor_gstin || "",
        invoice_date: ext.invoice_date || new Date().toISOString().split("T")[0],
        taxable_amount: Number(ext.taxable_amount ?? 0),
        gst_rate: Number(ext.gst_rate ?? 18),
        cgst_amount: Number(ext.cgst_amount ?? 0),
        sgst_amount: Number(ext.sgst_amount ?? 0),
        igst_amount: Number(ext.igst_amount ?? 0),
        total_amount: Number(ext.total_amount ?? 0),
        hsn_code: ext.hsn_code || "",
        item_description: ext.item_description || lines[0]?.description || "",
        items: lines,
        confidence: Number(scan.confidence_score ?? ext.confidence ?? 0),
        action: scan.action ?? ext.action ?? "manual",
        itc,
      });

      setStep("review");
    } catch (err: unknown) {
      if (isHardFailure(err)) {
        // Hard failure — upload pe wapas jao
        setError(getScanErrorMessage(err));
        setStep("upload");
        setEdited(null);
      } else {
        // Soft failure — review form dikhao taaki manually fill kar sake
        setNotice("AI kuch fields extract nahi kar paya. Manually fill karke save karo.");
        setEdited({ ...EMPTY_INVOICE });
        setStep("review");
      }
    }
  }

  // ── Invoice save karo database mein ───────────────────────────────────
  async function saveInvoice() {
    if (!edited) return;

    const business = getBusinessContext();
    if (!business?.id) {
      setError("Session expire ho gayi. Dobara sign in karo.");
      setStep("upload");
      return;
    }

    if (!edited.vendor_name.trim() || !edited.invoice_number.trim() || !edited.invoice_date) {
      setError("Vendor name, invoice number, aur date required hain.");
      return;
    }

    const lineItems = (edited.items.length > 0
      ? edited.items
      : [{
          description: edited.item_description.trim() || `Purchase from ${edited.vendor_name || "vendor"}`,
          hsn_sac: edited.hsn_code.trim(),
          quantity: 1,
          unit_price_paise: Number(edited.taxable_amount || 0),
          gst_rate: Number(edited.gst_rate || 18),
          taxable_amount: Number(edited.taxable_amount || 0),
          itc: edited.itc || undefined,
        }]
    ).filter((item) => Number(item.unit_price_paise || item.taxable_amount || 0) > 0);

    if (lineItems.length === 0) {
      setError("Taxable amount enter karo.");
      return;
    }

    setStep("saving");
    setError(null);

    try {
      const response = await apiFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          business_id: business.id,
          invoice_number: edited.invoice_number.trim(),
          invoice_date: edited.invoice_date,
          invoice_type: "purchase",
          party_name: edited.vendor_name.trim(),
          party_gstin: edited.vendor_gstin.trim().toUpperCase() || undefined,
          place_of_supply:
            edited.vendor_gstin.trim().length === 15
              ? edited.vendor_gstin.trim().slice(0, 2)
              : undefined,
          notes: "Scanned via AI bill capture",
          itc_eligibility: edited.itc?.itcEligibility || "eligible",
          items: lineItems.map((item) => ({
            description: item.description || edited.item_description || "Purchase",
            hsn_sac: item.hsn_sac || undefined,
            quantity: item.quantity || 1,
            unit_price_paise: Number(item.unit_price_paise || item.taxable_amount || 0),
            gst_rate: Number(item.gst_rate || edited.gst_rate || 18),
            itc_eligibility: item.itc?.itcEligibility || edited.itc?.itcEligibility || "eligible",
          })),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Invoice save nahi hua."));
      }

      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invoice save nahi hua.");
      setStep("review");
    }
  }

  // ── Reset — naya scan shuru karo ───────────────────────────────────────
  function reset() {
    setStep("upload");
    setPreview(null);
    setFile(null);
    setEdited(null);
    setError(null);
    setNotice(null);
  }

  // ── Field update helper ────────────────────────────────────────────────
  function updateField<K extends keyof ScannedInvoiceData>(
    key: K,
    value: ScannedInvoiceData[K]
  ) {
    setError(null);
    setEdited((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  const confMeta = edited ? getConfidenceTone(edited.confidence) : null;

  return (
    <>


      {/* ── Top Navigation ───────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Dashboard
        </button>
        <div className="topbar-brand">AI Scan</div>
        <button className="back-btn" onClick={() => navigate("invoices")}>
          Invoices
        </button>
      </header>

      <main className="page">

        {/* ── Error aur Notice Banners ─────────────────────────────────── */}
        {error && <div role="alert" className="banner banner-error">{error}</div>}
        {notice && <div role="status" className="banner banner-notice">{notice}</div>}

        {/* ════════════════════════════════════════════════════════════════
            STEP 1: UPLOAD — Image select karo
            ════════════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <>
            {/* Hero text */}
            <div className="scan-hero">
              <div className="scan-eyebrow">Bill Scan</div>
              <h1 className="scan-title">Purchase bill scan karo</h1>
              <p className="scan-desc">
                Photo ya PDF upload karo. AI line items nikaalta hai aur har line pe batata hai —
                ITC eligible, Section 17(5) blocked, ya RCM — pehle save karo{" "}
                <strong>{businessName}</strong> ke liye.
              </p>
            </div>

            <div className="upload-grid">
              {/* Upload Panel */}
              <div className="upload-card">
                {!preview ? (
                  /* Drag zone — file select karne ke liye */
                  <div className="dropzone" role="button" tabIndex={0} aria-label="Choose a bill image or PDF" onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileRef.current?.click();}}} onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("dropzone-active");}} onDragLeave={e=>e.currentTarget.classList.remove("dropzone-active")} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("dropzone-active");const dropped=e.dataTransfer.files[0];if(dropped)handleFile(dropped);}} onClick={() => fileRef.current?.click()}>
                    <div className="drop-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="drop-title">Bill photo ya PDF choose karo</p>
                    <p className="drop-sub">JPG, PNG, WEBP, PDF — max 10MB</p>
                  </div>
                ) : (
                  <div className="preview-wrap">
                    <img src={preview} alt="Invoice preview" className="preview-img" />
                    <button className="change-btn" onClick={reset}>Change image</button>
                  </div>
                )}

                {!preview && file && (
                  <div className="pdf-chip">
                    PDF ready: <strong>{file.name}</strong>
                    <button className="change-btn" onClick={reset} style={{ marginLeft: 8 }}>Change</button>
                  </div>
                )}

                <div className="upload-actions">
                  {!file ? (
                    <>
                      <button className="btn-pri" onClick={() => fileRef.current?.click()}>
                        Select File
                      </button>
                      <button className="btn-sec" onClick={() => camRef.current?.click()}>
                        Use Camera
                      </button>
                    </>
                  ) : (
                    <button className="btn-pri full-btn" onClick={scanBill}>
                      Scan with AI →
                    </button>
                  )}
                </div>

                <input
                  ref={fileRef} type="file" accept="image/*,application/pdf,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <input
                  ref={camRef} type="file" accept="image/*" capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              <div className="info-card">
                <div className="info-title">AI kya nikaalta hai</div>
                {[
                  ["Vendor & GSTIN", "Seller naam aur GSTIN"],
                  ["Line items", "Description, HSN, qty, rate"],
                  ["ITC decision", "Eligible / blocked 17(5) / RCM — har line pe"],
                ].map(([title, desc]) => (
                  <div key={title} className="info-row">
                    <div className="info-dot" />
                    <div>
                      <strong>{title}</strong>
                      <span>{desc}</span>
                    </div>
                  </div>
                ))}
                <div className="info-tip">
                  <strong>Tip:</strong> Use a bright, flat photo for best results. Avoid blur and shadows.
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 2: SCANNING — AI kaam kar raha hai
            ════════════════════════════════════════════════════════════════ */}
        {step === "scanning" && (
          <div className="status-card">
            <div className="scan-spinner" />
            <h2>Analyzing invoice…</h2>
            <p>AI is reading vendor, invoice, and tax values from your image.<br />This usually takes 5–15 seconds.</p>
            {preview && <img src={preview} alt="" className="scan-thumb" />}
            <div className="scan-steps">
              {["Reading invoice layout", "Identifying vendor & GSTIN", "Extracting tax breakdown"].map((s) => (
                <div key={s} className="scan-step-row">
                  <div className="step-dot step-active" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 3: REVIEW — User fields verify kare
            ════════════════════════════════════════════════════════════════ */}
        {step === "review" && edited && (
          <div className="review-layout">
            {/* Left: Form */}
            <div className="form-card">
              <div className="form-header">
                <div>
                  <div className="form-eyebrow">Review & Confirm</div>
                  <h2 className="form-title">Verify extracted fields</h2>
                </div>
                {confMeta && (
                  <span className={`conf-badge ${confMeta.cls}`}>
                    {confMeta.label}
                  </span>
                )}
              </div>

              <div className="field-grid">
                {/* Vendor Name */}
                <label className="field field-full">
                  <span>Vendor Name *</span>
                  <input
                    className="field-input"
                    value={edited.vendor_name}
                    onChange={(e) => updateField("vendor_name", e.target.value)}
                    placeholder="Vendor ka naam"
                  />
                </label>

                {/* Vendor GSTIN */}
                <label className="field field-full">
                  <span>Vendor GSTIN</span>
                  <input
                    className="field-input mono-input"
                    value={edited.vendor_gstin}
                    onChange={(e) => updateField("vendor_gstin", e.target.value.toUpperCase())}
                    placeholder="15-character GSTIN (optional)"
                    maxLength={15}
                  />
                </label>

                {/* Invoice Number */}
                <label className="field">
                  <span>Invoice Number *</span>
                  <input
                    className="field-input"
                    value={edited.invoice_number}
                    onChange={(e) => updateField("invoice_number", e.target.value)}
                    placeholder="INV-001"
                  />
                </label>

                {/* Invoice Date */}
                <label className="field">
                  <span>Invoice Date *</span>
                  <input
                    className="field-input"
                    type="date"
                    value={edited.invoice_date}
                    onChange={(e) => updateField("invoice_date", e.target.value)}
                  />
                </label>

                <label className="field field-full">
                  <span>Main item / expense description</span>
                  <input
                    className="field-input"
                    value={edited.item_description}
                    onChange={(e) => updateField("item_description", e.target.value)}
                    placeholder="e.g. Staff lunch, steel sheets, advocate fees"
                  />
                </label>

                {edited.items.length > 0 && (
                  <div className="field field-full">
                    <span>Line items + ITC</span>
                    <div className="line-itc-list">
                      {edited.items.map((line, idx) => (
                        <div key={`${line.description}-${idx}`} className={`line-itc-row line-${line.itc?.itcEligibility || "eligible"}`}>
                          <div>
                            <strong>{line.description || "Purchase"}</strong>
                            <p>
                              {formatRupees(line.taxable_amount || line.unit_price_paise)}
                              {line.hsn_sac ? ` · HSN ${line.hsn_sac}` : ""}
                              {` · ${line.gst_rate || edited.gst_rate}%`}
                            </p>
                          </div>
                          <div className="line-itc-badge">
                            {line.itc?.itcEligibility === "blocked"
                              ? `Blocked ${formatRupees(line.itc.blockedPaise)}`
                              : line.itc?.itcEligibility === "rcm_applicable"
                                ? "RCM"
                                : `Eligible ${formatRupees(line.itc?.claimablePaise || 0)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HSN Code */}
                <label className="field">
                  <span>HSN / SAC Code</span>
                  <input
                    className="field-input"
                    value={edited.hsn_code}
                    onChange={(e) => updateField("hsn_code", e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                {/* GST Rate */}
                <label className="field">
                  <span>GST Rate (%)</span>
                  <select
                    className="field-input"
                    value={edited.gst_rate}
                    onChange={(e) => updateField("gst_rate", Number(e.target.value))}
                  >
                    {[0, 5, 12, 18, 28].map((r) => (
                      <option key={r} value={r}>{r}%</option>
                    ))}
                  </select>
                </label>

                {/* Taxable Amount */}
                <label className="field">
                  <span>Taxable Amount (₹) *</span>
                  <input
                    className="field-input"
                    type="number" min="0" step="0.01"
                    value={formatAmountInput(edited.taxable_amount)}
                    onChange={(e) => updateField("taxable_amount", parseAmountInput(e.target.value))}
                    placeholder="0.00"
                  />
                </label>

                {/* CGST */}
                <label className="field">
                  <span>CGST Amount (₹)</span>
                  <input
                    className="field-input"
                    type="number" min="0" step="0.01"
                    value={formatAmountInput(edited.cgst_amount)}
                    onChange={(e) => updateField("cgst_amount", parseAmountInput(e.target.value))}
                    placeholder="0.00"
                  />
                </label>

                {/* SGST */}
                <label className="field">
                  <span>SGST Amount (₹)</span>
                  <input
                    className="field-input"
                    type="number" min="0" step="0.01"
                    value={formatAmountInput(edited.sgst_amount)}
                    onChange={(e) => updateField("sgst_amount", parseAmountInput(e.target.value))}
                    placeholder="0.00"
                  />
                </label>

                {/* IGST */}
                <label className="field">
                  <span>IGST Amount (₹)</span>
                  <input
                    className="field-input"
                    type="number" min="0" step="0.01"
                    value={formatAmountInput(edited.igst_amount)}
                    onChange={(e) => updateField("igst_amount", parseAmountInput(e.target.value))}
                    placeholder="0.00"
                  />
                </label>

                {/* Total Amount */}
                <label className="field">
                  <span>Grand Total (₹) *</span>
                  <input
                    className="field-input"
                    type="number" min="0" step="0.01"
                    value={formatAmountInput(edited.total_amount)}
                    onChange={(e) => updateField("total_amount", parseAmountInput(e.target.value))}
                    placeholder="0.00"
                  />
                </label>
              </div>
            </div>

            {/* Right: Summary + Save */}
            <div className="summary-card">
              {edited.itc && (
                <div className={`itc-card itc-${edited.itc.itcEligibility}`}>
                  <div className="itc-kicker">
                    {edited.itc.itcEligibility === "blocked"
                      ? "Do not claim this ITC"
                      : edited.itc.itcEligibility === "rcm_applicable"
                        ? "RCM — pay in cash first"
                        : "ITC looks eligible"}
                  </div>
                  <div className="itc-money">
                    {edited.itc.itcEligibility === "blocked"
                      ? formatRupees(edited.itc.blockedPaise)
                      : formatRupees(edited.itc.claimablePaise)}
                  </div>
                  <p className="itc-copy">{edited.itc.explanation}</p>
                  {edited.itc.blockedSection && (
                    <div className="itc-ref">{edited.itc.blockedSection}</div>
                  )}
                </div>
              )}
              <div className="summary-title">Tax Summary</div>

              {[
                ["Taxable", formatRupees(edited.taxable_amount)],
                ...(edited.cgst_amount > 0 ? [["CGST", formatRupees(edited.cgst_amount)]] : []),
                ...(edited.sgst_amount > 0 ? [["SGST", formatRupees(edited.sgst_amount)]] : []),
                ...(edited.igst_amount > 0 ? [["IGST", formatRupees(edited.igst_amount)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="summary-row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}

              <div className="summary-total">
                <span>Grand Total</span>
                <strong>{formatRupees(edited.total_amount || 0)}</strong>
              </div>

              <div className="review-actions">
                <button className="btn-pri full-btn" onClick={saveInvoice}>
                  Save as Purchase Invoice
                </button>
                <button className="btn-sec full-btn" onClick={reset}>
                  Discard & Rescan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 4: SAVING — Invoice DB mein save ho raha hai
            ════════════════════════════════════════════════════════════════ */}
        {step === "saving" && (
          <div className="status-card">
            <div className="scan-spinner" />
            <h2>Saving invoice…</h2>
            <p>Purchase invoice create ki ja rahi hai aur register mein add ki ja rahi hai.</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            STEP 5: DONE — Success!
            ════════════════════════════════════════════════════════════════ */}
        {step === "done" && (
          <div className="status-card success-card">
            <div className="success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2>Invoice saved!</h2>
            <p>Purchase invoice register mein add ho gayi.<br />ITC decision GSTR-3B compute mein use hogi.</p>
            <div className="done-btns">
              <button className="btn-pri" onClick={reset}>Scan Another Invoice</button>
              <button className="btn-sec" onClick={() => navigate("invoices")}>View Invoices</button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Same clean SaaS design system
// ─────────────────────────────────────────────────────────────────────────────
