// ─────────────────────────────────────────────────────────────────────────────
// Scan.tsx — AI Invoice Scanner Page
// User yahan apna GST bill upload karta hai
// Gemini AI bill scan karta hai aur saare fields extract karta hai
// Phir user verify karke invoice save kar sakta hai
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { getApiErrorMessage } from "../lib/api";
import { getBusinessContext, getToken } from "../lib/session";

// Route type — navigate ke liye
type Route = "login" | "dashboard" | "scan" | "invoices" | "export";

// Props — parent se navigate milta hai
interface Props {
  navigate: (route: Route) => void;
}

// Scan se extract hone wala data ka structure
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
  confidence: number;       // 0-100
  action: "auto" | "review" | "manual";
}

import { BASE_URL } from "../lib/api";

// Scan ka flow — kahan hai user abhi
type ScanStep = "upload" | "scanning" | "review" | "saving" | "done";

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
  confidence: 0,
  action: "manual",
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
    if (!nextFile.type.startsWith("image/")) {
      setError("Sirf image file upload kar sakte hain (JPG, PNG, WEBP).");
      return;
    }
    setFile(nextFile);
    setError(null);
    setNotice(null);

    // Preview ke liye FileReader use karo
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(nextFile);
  }

  // ── Scan API call karo ─────────────────────────────────────────────────
  async function scanBill() {
    if (!file) return;

    const token = getToken();
    const business = getBusinessContext();

    // Session check — agar login nahi hai
    if (!token || !business?.id) {
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

      const response = await fetch(`${BASE_URL}/scans`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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

      // Agar confidence kam hai toh notice dikhao
      if (Number(scan.confidence_score ?? ext.confidence ?? 0) < 65) {
        setNotice("AI confidence kam hai. Fields manually verify kar lo.");
      }

      // Extracted data review form mein set karo
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
        confidence: Number(scan.confidence_score ?? ext.confidence ?? 0),
        action: scan.action ?? ext.action ?? "manual",
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

    const token = getToken();
    const business = getBusinessContext();

    if (!token || !business?.id) {
      setError("Session expire ho gayi. Dobara sign in karo.");
      setStep("upload");
      return;
    }

    // Required fields validate karo
    if (!edited.vendor_name.trim() || !edited.invoice_number.trim() || !edited.invoice_date) {
      setError("Vendor name, invoice number, aur date required hain.");
      return;
    }
    if (Number(edited.taxable_amount || 0) <= 0) {
      setError("Taxable amount enter karo.");
      return;
    }

    setStep("saving");
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_id: business.id,
          invoice_number: edited.invoice_number.trim(),
          invoice_date: edited.invoice_date,
          invoice_type: "purchase",   // Scan se sirf purchase invoices aate hain
          party_name: edited.vendor_name.trim(),
          party_gstin: edited.vendor_gstin.trim().toUpperCase() || undefined,
          place_of_supply:
            edited.vendor_gstin.trim().length === 15
              ? edited.vendor_gstin.trim().slice(0, 2)
              : undefined,
          notes: "Scanned via AI bill capture",
          items: [
            {
              description: `Purchase from ${edited.vendor_name || "vendor"}`,
              hsn_sac: edited.hsn_code.trim() || undefined,
              quantity: 1,
              unit_price_paise: Number(edited.taxable_amount || 0),
              gst_rate: Number(edited.gst_rate || 18),
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Invoice save nahi hua."));
      }

      // Successfully saved!
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
      <style>{STYLES}</style>

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
        {error && <div className="banner banner-error">{error}</div>}
        {notice && <div className="banner banner-notice">{notice}</div>}

        {/* ════════════════════════════════════════════════════════════════
            STEP 1: UPLOAD — Image select karo
            ════════════════════════════════════════════════════════════════ */}
        {step === "upload" && (
          <>
            {/* Hero text */}
            <div className="scan-hero">
              <div className="scan-eyebrow">Invoice Capture</div>
              <h1 className="scan-title">Scan a GST invoice</h1>
              <p className="scan-desc">
                Upload a clear photo of a GST bill. AI will extract vendor details,
                invoice number, GST amounts, and save it as a purchase invoice for{" "}
                <strong>{businessName}</strong>.
              </p>
            </div>

            <div className="upload-grid">
              {/* Upload Panel */}
              <div className="upload-card">
                {!preview ? (
                  /* Drag zone — file select karne ke liye */
                  <div className="dropzone" onClick={() => fileRef.current?.click()}>
                    <div className="drop-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="drop-title">Click to choose a bill image</p>
                    <p className="drop-sub">JPG, PNG, or WEBP — max 10MB</p>
                  </div>
                ) : (
                  /* Preview — image select ho gaya */
                  <div className="preview-wrap">
                    <img src={preview} alt="Invoice preview" className="preview-img" />
                    <button className="change-btn" onClick={reset}>Change image</button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="upload-actions">
                  {!preview ? (
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

                {/* Hidden file inputs */}
                <input
                  ref={fileRef} type="file" accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <input
                  ref={camRef} type="file" accept="image/*" capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {/* Info Panel — kya extract hoga */}
              <div className="info-card">
                <div className="info-title">What AI extracts</div>
                {[
                  ["Vendor & GSTIN", "Business name, GST registration number"],
                  ["Invoice Details", "Invoice number, date, HSN/SAC code"],
                  ["Tax Breakdown", "Taxable value, CGST, SGST, IGST, total"],
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
            <p>Purchase invoice register mein add ho gayi.<br />GST calculations mein automatically include ho jayegi.</p>
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
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..900;1,14..32,300..900&family=JetBrains+Mono:wght@600;700&display=swap');

*{box-sizing:border-box;margin:0;padding:0}
body{background:#f9fafb;font-family:'Inter',sans-serif;color:#111827;-webkit-font-smoothing:antialiased}
button,input,select{font-family:inherit;outline:none}

/* ── Top Navigation ─────────────────────────────────────────────────────── */
.topbar{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;gap:16px;
  padding:0 20px;height:56px;
  background:#fff;border-bottom:1px solid #e5e7eb;
}
.topbar-brand{
  font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;
  color:#111827;flex:1;text-align:center;
}
.back-btn{
  padding:7px 12px;border-radius:7px;
  background:#f9fafb;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;
  transition:all .15s;cursor:pointer;
}
.back-btn:hover{background:#f3f4f6}

/* ── Page Layout ─────────────────────────────────────────────────────────── */
.page{
  max-width:960px;margin:0 auto;
  padding:28px 20px 100px;
  display:flex;flex-direction:column;gap:20px;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn-pri{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:11px 20px;border-radius:8px;
  background:#f97316;color:#fff;cursor:pointer;
  font-size:14px;font-weight:600;border:none;
  box-shadow:0 1px 3px rgba(249,115,22,.3);
  transition:all .15s;
}
.btn-pri:hover{background:#ea580c;transform:translateY(-1px);box-shadow:0 4px 12px rgba(249,115,22,.35)}
.btn-sec{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:11px 20px;border-radius:8px;
  background:#fff;color:#374151;cursor:pointer;
  font-size:14px;font-weight:600;
  border:1px solid #d1d5db;transition:all .15s;
}
.btn-sec:hover{background:#f3f4f6}
.full-btn{width:100%}

/* ── Error/Notice Banners ────────────────────────────────────────────────── */
.banner{
  padding:12px 16px;border-radius:9px;
  font-size:14px;font-weight:500;line-height:1.5;
}
.banner-error{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b}
.banner-notice{background:#fef3c7;border:1px solid #fde68a;color:#92400e}

/* ── Hero Section ────────────────────────────────────────────────────────── */
.scan-hero{padding:0 0 4px}
.scan-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:#9ca3af;margin-bottom:8px;
}
.scan-title{font-size:24px;font-weight:800;color:#111827;margin-bottom:8px}
.scan-desc{font-size:14px;color:#6b7280;line-height:1.65;max-width:60ch}

/* ── Upload Grid ─────────────────────────────────────────────────────────── */
.upload-grid{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}

/* Upload Card */
.upload-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:24px;display:flex;flex-direction:column;gap:16px;
}

/* Dropzone */
.dropzone{
  border:2px dashed #d1d5db;border-radius:10px;
  padding:40px 20px;text-align:center;cursor:pointer;
  transition:all .15s;background:#f9fafb;
}
.dropzone:hover{border-color:#f97316;background:#fff7f5}
.drop-icon{
  width:56px;height:56px;border-radius:12px;background:#f3f4f6;
  display:flex;align-items:center;justify-content:center;
  color:#9ca3af;margin:0 auto 12px;
}
.drop-title{font-size:15px;font-weight:600;color:#374151;margin-bottom:6px}
.drop-sub{font-size:13px;color:#9ca3af}

/* Preview */
.preview-wrap{position:relative;text-align:center}
.preview-img{
  max-height:240px;border-radius:10px;
  object-fit:contain;border:1px solid #e5e7eb;width:100%;
}
.change-btn{
  margin-top:10px;padding:7px 16px;border-radius:7px;
  background:#f3f4f6;border:1px solid #e5e7eb;
  font-size:13px;font-weight:600;color:#374151;cursor:pointer;
  transition:all .15s;
}
.change-btn:hover{background:#e5e7eb}

/* Upload actions */
.upload-actions{display:flex;gap:10px}

/* Info Card */
.info-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:20px;display:flex;flex-direction:column;gap:12px;
}
.info-title{
  font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:#6b7280;margin-bottom:4px;
}
.info-row{display:flex;gap:10px;align-items:flex-start}
.info-dot{
  width:7px;height:7px;border-radius:50%;background:#f97316;
  flex-shrink:0;margin-top:5px;
}
.info-row strong{display:block;font-size:13px;font-weight:700;color:#111827;margin-bottom:2px}
.info-row span{font-size:12px;color:#6b7280;line-height:1.5}
.info-tip{
  padding:12px;border-radius:8px;background:#fefce8;border:1px solid #fde68a;
  font-size:12px;color:#78350f;line-height:1.55;
}

/* ── Status Cards (scanning / saving / done) ─────────────────────────────── */
.status-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:48px 32px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:14px;
  max-width:520px;margin:0 auto;
}
.status-card h2{font-size:20px;font-weight:700;color:#111827}
.status-card p{font-size:14px;color:#6b7280;line-height:1.65}

/* Scanning spinner */
.scan-spinner{
  width:40px;height:40px;border-radius:50%;
  border:3px solid #e5e7eb;border-top-color:#f97316;
  animation:spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* Scan thumbnail during scanning */
.scan-thumb{
  max-height:120px;border-radius:8px;
  object-fit:contain;border:1px solid #e5e7eb;opacity:.7;
}

/* Scan steps */
.scan-steps{display:flex;flex-direction:column;gap:8px;text-align:left;width:100%;max-width:300px}
.scan-step-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#6b7280}
.step-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.step-active{background:#f97316;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* Success card */
.success-card{border-color:#bbf7d0;background:#f0fdf4}
.success-icon{
  width:56px;height:56px;border-radius:50%;
  background:#d1fae5;display:flex;align-items:center;
  justify-content:center;color:#059669;
}
.done-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}

/* ── Review Layout ───────────────────────────────────────────────────────── */
.review-layout{display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start}

/* Form Card */
.form-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;
}
.form-header{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:16px;margin-bottom:20px;flex-wrap:wrap;
}
.form-eyebrow{
  font-size:11px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:#9ca3af;margin-bottom:5px;
}
.form-title{font-size:18px;font-weight:700;color:#111827}

/* Confidence Badge */
.conf-badge{
  display:inline-flex;align-items:center;
  padding:5px 11px;border-radius:6px;
  font-size:12px;font-weight:600;flex-shrink:0;
}
.conf-high{background:#d1fae5;color:#065f46}
.conf-mid{background:#fef3c7;color:#92400e}
.conf-low{background:#fee2e2;color:#991b1b}

/* Field Grid */
.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field{display:flex;flex-direction:column;gap:6px}
.field-full{grid-column:1/-1}
.field span{font-size:12px;font-weight:600;color:#6b7280}
.field-input{
  padding:10px 12px;border-radius:8px;
  border:1.5px solid #e5e7eb;background:#fff;
  font-size:14px;color:#111827;
  transition:border-color .15s,box-shadow .15s;
}
.field-input:focus{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.1)}
.field-input::placeholder{color:#9ca3af}
.mono-input{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.04em}

/* Summary Card */
.summary-card{
  background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  padding:20px;position:sticky;top:72px;
  display:flex;flex-direction:column;gap:10px;
}
.summary-title{
  font-size:12px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:#6b7280;margin-bottom:4px;
}
.summary-row{
  display:flex;justify-content:space-between;align-items:center;
  font-size:13px;color:#374151;
  padding:8px 0;border-bottom:1px solid #f3f4f6;
}
.summary-row strong{font-family:'JetBrains Mono',monospace;font-weight:700}
.summary-total{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 0 0;font-size:14px;font-weight:700;color:#111827;
}
.summary-total strong{
  font-family:'JetBrains Mono',monospace;font-size:18px;
  font-weight:800;color:#f97316;
}
.review-actions{display:flex;flex-direction:column;gap:8px;margin-top:4px}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:840px){
  .upload-grid{grid-template-columns:1fr}
  .review-layout{grid-template-columns:1fr}
  .summary-card{position:static}
}
@media(max-width:640px){
  .page{padding:20px 14px 100px}
  .topbar{padding:0 14px}
  .field-grid{grid-template-columns:1fr}
  .field-full{grid-column:1}
  .upload-actions{flex-direction:column}
}
`;
