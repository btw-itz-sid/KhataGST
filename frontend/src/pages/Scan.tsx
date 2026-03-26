import { useRef, useState } from "react";
import { getApiErrorMessage } from "../lib/api";
import { getBusinessContext, getToken } from "../lib/session";

type Route = "login" | "dashboard" | "scan" | "invoices" | "export";

interface Props {
  navigate: (route: Route) => void;
}

interface ScannedInvoiceData {
  invoice_number: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_date: string;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  hsn_code: string;
  confidence: number;
  action: "auto" | "review" | "manual";
}

const BASE_URL = "/api/v1";

function formatRupees(paise: number): string {
  return `INR ${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmountInput(paise: number): string {
  if (!Number.isFinite(paise) || paise === 0) return "";
  return (paise / 100).toFixed(2);
}

function parseAmountInput(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const rupees = Number(normalized);
  return Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

// Returns true only for hard failures where retry makes sense
function isHardFailure(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("api key missing") ||
    message.includes("scan response is incomplete") ||
    message.includes("temporarily unavailable")
  );
}

function getScanFailureMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Scan complete nahi hua. Dobara try karo.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("429") || message.includes("quota")) {
    return "AI scan abhi busy hai. Thodi der baad try karo.";
  }

  if (message.includes("network") || message.includes("fetch failed") || message.includes("econnreset")) {
    return "Network error. Connection check karo aur dobara try karo.";
  }

  if (message.includes("api key missing")) {
    return "AI scan setup nahi hai. Admin se contact karo.";
  }

  return "Scan fail hua. Dobara try karo.";
}

function getScanNotice(scan: unknown): string | null {
  const record = asRecord(scan);
  if (!record) return null;

  const extracted = asRecord(record.extracted_data) ?? record;
  const mockMode = record.mock_mode === true;
  const fallbackMode =
    typeof record.fallback_mode === "string" ? record.fallback_mode : "";
  const fallbackReason =
    typeof record.fallback_reason === "string" ? record.fallback_reason.trim() : "";
  const confidence =
    typeof record.confidence_score === "number"
      ? record.confidence_score
      : typeof extracted.confidence === "number"
        ? extracted.confidence
        : 0;
  const invoiceNumber =
    typeof extracted.invoice_number === "string" ? extracted.invoice_number.trim() : "";
  const vendorName =
    typeof extracted.vendor_name === "string" ? extracted.vendor_name.trim() : "";

  if (!mockMode && fallbackMode !== "manual_review") {
    if (confidence > 0 || invoiceNumber || vendorName) {
      return null;
    }
    return "Scan ne kuch fields extract nahi kiye. Manually fill karke save karo.";
  }

  return (
    fallbackReason ||
    "AI extraction abhi available nahi. Fields manually fill karke save karo."
  );
}

function getConfidenceMeta(confidence: number) {
  if (confidence >= 85) {
    return { tone: "good", label: "High confidence" };
  }
  if (confidence >= 65) {
    return { tone: "warn", label: "Review recommended" };
  }
  return { tone: "bad", label: "Manual check advised" };
}

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

export default function Scan({ navigate }: Props) {
  const [step, setStep] = useState<
    "upload" | "scanning" | "review" | "saving" | "done"
  >("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [edited, setEdited] = useState<ScannedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const businessName = getBusinessContext()?.name || "Current business";
  const confidenceMeta = getConfidenceMeta(edited?.confidence ?? 0);

  function updateField<K extends keyof ScannedInvoiceData>(
    key: K,
    value: ScannedInvoiceData[K]
  ) {
    setError(null);
    setEdited((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleFile(nextFile: File) {
    if (!nextFile.type.startsWith("image/")) {
      setError("Valid image file upload karo.");
      return;
    }
    setFile(nextFile);
    setError(null);
    setNotice(null);
    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target?.result as string);
    reader.readAsDataURL(nextFile);
  }

  async function scanBill() {
    if (!file) return;

    const token = getToken();
    const business = getBusinessContext();

    if (!token || !business?.id) {
      setError("Business session missing. Dashboard pe wapas jao aur sign in karo.");
      return;
    }

    setStep("scanning");
    setError(null);
    setNotice(null);

    try {
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

      const scan = payload?.scan ?? payload?.data ?? null;
      if (!scan) throw new Error("Scan response incomplete hai.");

      const extracted = scan.extracted_data ?? scan;
      setNotice(getScanNotice(scan));
      setEdited({
        invoice_number: extracted.invoice_number || "",
        vendor_name: extracted.vendor_name || "",
        vendor_gstin: extracted.vendor_gstin || "",
        invoice_date:
          extracted.invoice_date || new Date().toISOString().split("T")[0],
        taxable_amount: Number(extracted.taxable_amount ?? 0),
        gst_rate: Number(extracted.gst_rate ?? 18),
        cgst_amount: Number(extracted.cgst_amount ?? 0),
        sgst_amount: Number(extracted.sgst_amount ?? 0),
        igst_amount: Number(extracted.igst_amount ?? 0),
        total_amount: Number(extracted.total_amount ?? 0),
        hsn_code: extracted.hsn_code || "",
        confidence: Number(scan.confidence_score ?? extracted.confidence ?? 0),
        action: scan.action ?? extracted.action ?? "manual",
      });

      setStep("review");
    } catch (err: unknown) {
      if (isHardFailure(err)) {
        // Real failure — show error, stay on upload
        setError(getScanFailureMessage(err));
        setNotice(null);
        setEdited(null);
        setStep("upload");
      } else {
        // Low confidence, missing GSTIN, JSON parse issues etc.
        // Don't block the user — show review form with empty fields
        setError(null);
        setNotice("Scan ne kuch fields extract nahi kiye. Manually fill karke save karo.");
        setEdited({ ...EMPTY_INVOICE });
        setStep("review");
      }
    }
  }

  async function saveInvoice() {
    if (!edited) return;

    const token = getToken();
    const business = getBusinessContext();

    if (!token || !business?.id) {
      setError("Business session missing. Dobara sign in karo.");
      setStep("upload");
      return;
    }

    if (!edited.vendor_name.trim() || !edited.invoice_number.trim() || !edited.invoice_date) {
      setError("Vendor name, invoice number, aur invoice date fill karo.");
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
          invoice_type: "purchase",
          party_name: edited.vendor_name.trim(),
          party_gstin: edited.vendor_gstin.trim().toUpperCase() || undefined,
          place_of_supply:
            edited.vendor_gstin.trim().length === 15
              ? edited.vendor_gstin.trim().slice(0, 2)
              : undefined,
          notes: "Created from bill scan flow",
          items: [
            {
              description: edited.vendor_name
                ? `Purchase from ${edited.vendor_name}`
                : "Purchase item",
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

      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invoice save fail hua.");
      setStep("review");
    }
  }

  function reset() {
    setStep("upload");
    setPreview(null);
    setFile(null);
    setEdited(null);
    setError(null);
    setNotice(null);
  }

  return (
    <>
      <style>{STYLES}</style>

      <nav className="scan-topbar">
        <button className="nav-btn" onClick={() => navigate("dashboard")}>
          Dashboard
        </button>
        <div className="scan-brand">
          Khata<span>GST</span>
        </div>
        <div className="nav-meta">AI Capture</div>
      </nav>

      <div className="scan-shell">
        {error && <div className="error-banner">{error}</div>}
        {notice && <div className="notice-banner">{notice}</div>}

        {step === "upload" && (
          <>
            <section className="scan-hero">
              <div className="kicker">Invoice Capture</div>
              <h1>Scan invoices into your register</h1>
              <p>
                Upload a GST bill image and extract vendor, invoice, and tax
                values into a structured purchase entry for {businessName}.
              </p>
              <div className="hero-tags">
                <span className="hero-tag">OCR + AI extraction</span>
                <span className="hero-tag">Purchase invoice ready</span>
                <span className="hero-tag">Direct save workflow</span>
              </div>
            </section>

            <div className="upload-grid">
              <section className="surface upload-panel">
                {!preview ? (
                  <>
                    <div
                      className="dropzone"
                      onClick={() => fileRef.current?.click()}
                    >
                      <div className="drop-icon">+</div>
                      <strong>Choose invoice image</strong>
                      <span>
                        Use a clean bill photo with invoice number, vendor, and
                        totals visible.
                      </span>
                    </div>
                    <div className="upload-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => fileRef.current?.click()}
                      >
                        Select file
                      </button>
                      <button
                        className="btn btn-soft"
                        onClick={() => camRef.current?.click()}
                      >
                        Use camera
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="preview-frame">
                      <img src={preview} className="preview-image" alt="" />
                      <button className="change-btn" onClick={reset}>
                        Change
                      </button>
                    </div>
                    <div className="preview-meta">
                      <div>
                        <span>Selected file</span>
                        <strong>{file?.name || "Invoice image"}</strong>
                      </div>
                      <button className="btn btn-primary" onClick={scanBill}>
                        Scan invoice
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) =>
                    event.target.files?.[0] && handleFile(event.target.files[0])
                  }
                />
                <input
                  ref={camRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(event) =>
                    event.target.files?.[0] && handleFile(event.target.files[0])
                  }
                />
              </section>

              <aside className="surface info-panel">
                <div>
                  <div className="panel-kicker">What gets captured</div>
                  <div className="info-list">
                    <div className="info-item">
                      <strong>Vendor and GSTIN</strong>
                      <span>Business name, GST number, and source party details.</span>
                    </div>
                    <div className="info-item">
                      <strong>Invoice metadata</strong>
                      <span>Invoice number, invoice date, and HSN reference.</span>
                    </div>
                    <div className="info-item">
                      <strong>Tax breakdown</strong>
                      <span>Taxable value, GST rate, CGST, SGST, IGST, and total.</span>
                    </div>
                  </div>
                </div>
                <div className="info-card">
                  <div className="panel-kicker">Best results</div>
                  <p>
                    Use a bright image, keep the invoice flat, and avoid blurry
                    edges. Cleaner uploads reduce manual review.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}

        {step === "scanning" && (
          <section className="surface scan-state">
            <div className="scan-stage">
              <div className="scan-kicker">Analyzing document</div>
              <h2>Extracting structured invoice fields</h2>
              <p>
                We are reading vendor, invoice, and tax values from the uploaded
                document. This usually takes a few seconds.
              </p>
              <div className="scan-steps">
                <div>Reading invoice layout</div>
                <div>Identifying vendor and totals</div>
                <div>Preparing purchase entry</div>
              </div>
            </div>
            <div className="scan-preview">
              <div className="scan-window">
                {preview && <img src={preview} className="scan-thumb" alt="" />}
                <div className="scan-line" />
              </div>
            </div>
          </section>
        )}

        {step === "review" && edited && (
          <>
            <section className="surface review-hero">
              <div>
                <div className="kicker">Review</div>
                <h2>Validate extracted values before saving</h2>
                <p>
                  Confirm the invoice details below, make corrections if needed,
                  and save the purchase invoice into your register.
                </p>
              </div>
              <div className={`confidence-card ${confidenceMeta.tone}`}>
                <span>Confidence</span>
                <strong>{edited.confidence}%</strong>
                <p>{confidenceMeta.label}</p>
              </div>
            </section>

            <div className="review-grid">
              <section className="surface form-panel">
                <div className="panel-kicker">Extracted fields</div>
                <div className="field-grid">
                  <label className="field field-full">
                    <span>Vendor name</span>
                    <input
                      className="input"
                      value={edited.vendor_name}
                      onChange={(event) =>
                        updateField("vendor_name", event.target.value)
                      }
                    />
                  </label>

                  <label className="field field-full">
                    <span>Vendor GSTIN</span>
                    <input
                      className="input"
                      value={edited.vendor_gstin}
                      placeholder="Leave empty if not applicable"
                      onChange={(event) =>
                        updateField(
                          "vendor_gstin",
                          event.target.value.toUpperCase()
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Invoice number</span>
                    <input
                      className="input"
                      value={edited.invoice_number}
                      onChange={(event) =>
                        updateField("invoice_number", event.target.value)
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Invoice date</span>
                    <input
                      className="input"
                      type="date"
                      value={edited.invoice_date}
                      onChange={(event) =>
                        updateField("invoice_date", event.target.value)
                      }
                    />
                  </label>

                  <label className="field">
                    <span>HSN code</span>
                    <input
                      className="input"
                      value={edited.hsn_code}
                      placeholder="Optional"
                      onChange={(event) =>
                        updateField("hsn_code", event.target.value)
                      }
                    />
                  </label>

                  <label className="field">
                    <span>GST rate %</span>
                    <input
                      className="input"
                      type="number"
                      value={edited.gst_rate}
                      onChange={(event) =>
                        updateField("gst_rate", Number(event.target.value || 0))
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Taxable amount (INR)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatAmountInput(edited.taxable_amount)}
                      onChange={(event) =>
                        updateField(
                          "taxable_amount",
                          parseAmountInput(event.target.value)
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>CGST amount (INR)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatAmountInput(edited.cgst_amount)}
                      onChange={(event) =>
                        updateField(
                          "cgst_amount",
                          parseAmountInput(event.target.value)
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>SGST amount (INR)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatAmountInput(edited.sgst_amount)}
                      onChange={(event) =>
                        updateField(
                          "sgst_amount",
                          parseAmountInput(event.target.value)
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>IGST amount (INR)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatAmountInput(edited.igst_amount)}
                      onChange={(event) =>
                        updateField(
                          "igst_amount",
                          parseAmountInput(event.target.value)
                        )
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Total amount (INR)</span>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formatAmountInput(edited.total_amount)}
                      onChange={(event) =>
                        updateField(
                          "total_amount",
                          parseAmountInput(event.target.value)
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <aside className="surface summary-panel">
                <div className="panel-kicker">Tax summary</div>

                <div className="amount-row">
                  <span>Taxable amount</span>
                  <strong>{formatRupees(edited.taxable_amount || 0)}</strong>
                </div>

                {(edited.cgst_amount || 0) > 0 && (
                  <div className="amount-row">
                    <span>CGST</span>
                    <strong>{formatRupees(edited.cgst_amount || 0)}</strong>
                  </div>
                )}

                {(edited.sgst_amount || 0) > 0 && (
                  <div className="amount-row">
                    <span>SGST</span>
                    <strong>{formatRupees(edited.sgst_amount || 0)}</strong>
                  </div>
                )}

                {(edited.igst_amount || 0) > 0 && (
                  <div className="amount-row">
                    <span>IGST</span>
                    <strong>{formatRupees(edited.igst_amount || 0)}</strong>
                  </div>
                )}

                <div className="amount-row total-row">
                  <span>Grand total</span>
                  <strong>{formatRupees(edited.total_amount || 0)}</strong>
                </div>

                <div className="review-actions">
                  <button className="btn btn-soft" onClick={reset}>
                    Discard
                  </button>
                  <button className="btn btn-primary" onClick={saveInvoice}>
                    Save purchase invoice
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}

        {step === "saving" && (
          <section className="surface status-panel">
            <div className="spinner" />
            <h2>Saving invoice to your register</h2>
            <p>
              We are creating a purchase invoice entry and attaching the scanned
              values to your business records.
            </p>
          </section>
        )}

        {step === "done" && (
          <section className="surface status-panel success-panel">
            <div className="success-mark">OK</div>
            <h2>Invoice saved successfully</h2>
            <p>
              The purchase invoice is now available in your register and will be
              included in downstream GST calculations.
            </p>
            <div className="review-actions">
              <button className="btn btn-primary" onClick={reset}>
                Scan another invoice
              </button>
              <button
                className="btn btn-soft"
                onClick={() => navigate("dashboard")}
              >
                Return to dashboard
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at top left,rgba(255,107,0,.1),transparent 22%),linear-gradient(180deg,#f8fafc 0%,#eef3f9 100%);font-family:'Manrope',sans-serif;color:#0f172a}
button,input{font-family:inherit}
.scan-topbar{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(219,227,239,.9);background:rgba(248,250,252,.88);backdrop-filter:blur(14px)}
.scan-brand{justify-self:center;font:700 18px 'IBM Plex Mono',monospace}.scan-brand span{color:#ff6b00}.nav-btn,.btn{border:none;cursor:pointer;transition:transform .15s ease}.nav-btn:hover,.btn:hover{transform:translateY(-1px)}.nav-btn{padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.06);color:#0f172a;font-size:13px;font-weight:800}.nav-meta{justify-self:end;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}
.scan-shell{max-width:1140px;margin:0 auto;padding:26px 16px 94px;display:flex;flex-direction:column;gap:18px}.surface{padding:22px;border-radius:26px;border:1px solid rgba(219,227,239,.94);background:rgba(255,255,255,.92);box-shadow:0 18px 36px rgba(15,23,42,.05)}
.kicker,.panel-kicker,.field span{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}.scan-hero{padding:28px 30px;border-radius:30px;background:radial-gradient(circle at top right,rgba(255,107,0,.24),transparent 28%),linear-gradient(135deg,#0f172a 0%,#172554 52%,#1e293b 100%);color:#fff;box-shadow:0 28px 56px rgba(15,23,42,.16)}.scan-hero .kicker{margin-bottom:10px;color:rgba(255,255,255,.58)}.scan-hero h1,.review-hero h2,.status-panel h2{margin:0;font-size:clamp(34px,5vw,48px);line-height:.96;font-weight:800;letter-spacing:-.04em}.review-hero h2,.status-panel h2{font-size:24px;line-height:1.08;color:#0f172a}.scan-hero p,.review-hero p,.status-panel p{max-width:60ch;margin:16px 0 0;font-size:15px;line-height:1.8;color:rgba(255,255,255,.78)}.review-hero p,.status-panel p{color:#5f6c80}
.hero-tags,.upload-actions,.review-actions,.hero-meta{display:flex;flex-wrap:wrap;gap:10px}.hero-tags{margin-top:20px}.hero-tag{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);font-size:11px;font-weight:700;color:rgba(255,255,255,.84)}
.upload-grid,.review-grid,.scan-state{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.8fr);gap:16px}.info-panel,.summary-panel{display:flex;flex-direction:column;gap:16px}
.dropzone{display:grid;place-items:center;text-align:center;gap:10px;min-height:320px;padding:28px;border-radius:24px;border:1.5px dashed #cdd7e4;background:linear-gradient(180deg,#fbfcfe 0%,#f3f6fb 100%);cursor:pointer}.drop-icon{width:56px;height:56px;display:grid;place-items:center;border-radius:18px;background:#fff2e8;color:#ff6b00;font-size:28px;font-weight:700}.dropzone strong,.info-item strong,.preview-meta strong{font-size:16px;font-weight:800;color:#0f172a}.dropzone span,.info-item span,.info-card p,.preview-meta span,.scan-steps div,.amount-row span,.field input,.field label,.deadline-date{font-size:13px;line-height:1.7;color:#5f6c80}
.btn{padding:12px 16px;border-radius:14px;font-size:13px;font-weight:800}.btn-primary{background:linear-gradient(135deg,#ff7a1a 0%,#ea580c 100%);color:#fff;box-shadow:0 16px 28px rgba(234,88,12,.2)}.btn-soft{background:rgba(15,23,42,.06);color:#0f172a}.upload-actions{margin-top:16px}
.preview-frame{position:relative;overflow:hidden;border-radius:24px;border:1px solid #dbe3ef;background:#fff}.preview-image{display:block;width:100%;max-height:460px;object-fit:cover}.change-btn{position:absolute;top:14px;right:14px;padding:9px 12px;border:none;border-radius:12px;background:rgba(15,23,42,.74);color:#fff;font-size:12px;font-weight:800;cursor:pointer}.preview-meta{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px}
.info-list{display:flex;flex-direction:column;gap:10px}.info-item,.info-card{padding:16px;border-radius:18px;border:1px solid #dbe3ef;background:rgba(255,255,255,.86)}.error-banner,.notice-banner{padding:14px 16px;border-radius:18px;font-size:14px;font-weight:700}.error-banner{border:1px solid #fecaca;background:#fef2f2;color:#dc2626}.notice-banner{border:1px solid #fbd38d;background:#fff7ed;color:#c2410c}
.scan-stage h2{margin:0;font-size:30px;line-height:1.02;font-weight:800;letter-spacing:-.04em}.scan-stage p{margin:14px 0 0;font-size:14px;line-height:1.75;color:#5f6c80}.scan-kicker{margin-bottom:10px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}.scan-steps{display:grid;gap:10px;margin-top:20px}.scan-steps div{padding:12px 14px;border-radius:16px;background:#f8fafc;border:1px solid #dbe3ef}.scan-preview{display:flex;align-items:center;justify-content:center}.scan-window{position:relative;overflow:hidden;width:min(100%,320px);aspect-ratio:4/5;border-radius:24px;border:1px solid #dbe3ef;background:linear-gradient(180deg,#eef2f7 0%,#f8fafc 100%)}.scan-thumb{width:100%;height:100%;object-fit:cover;opacity:.72}.scan-line{position:absolute;left:0;right:0;height:3px;background:#ff6b00;box-shadow:0 0 10px rgba(255,107,0,.6);animation:scan 1.8s ease-in-out infinite}
.review-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.confidence-card{min-width:200px;padding:18px;border-radius:20px;border:1px solid #dbe3ef;background:#fff}.confidence-card span{display:block;margin-bottom:8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}.confidence-card strong{display:block;font:700 30px 'IBM Plex Mono',monospace}.confidence-card p{margin:8px 0 0;font-size:13px;line-height:1.6}.confidence-card.good strong,.confidence-card.good p{color:#059669}.confidence-card.warn strong,.confidence-card.warn p{color:#d97706}.confidence-card.bad strong,.confidence-card.bad p{color:#dc2626}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.field{display:flex;flex-direction:column;gap:8px}.field-full{grid-column:1/-1}.input{width:100%;padding:12px 14px;border-radius:14px;border:1.5px solid #dbe3ef;background:#fff;color:#0f172a;font-size:14px;outline:none}.input:focus{border-color:#ff6b00;box-shadow:0 0 0 4px rgba(255,107,0,.08)}
.amount-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e8eef5}.amount-row strong{font:700 14px 'IBM Plex Mono',monospace;color:#0f172a}.total-row strong{color:#ff6b00}.review-actions{margin-top:18px}
.status-panel{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:28px}.spinner{width:40px;height:40px;border-radius:999px;border:3px solid #dbe3ef;border-top-color:#ff6b00;animation:spin .7s linear infinite}.success-mark{width:54px;height:54px;display:grid;place-items:center;border-radius:18px;background:#ecfdf5;color:#059669;font:800 14px 'IBM Plex Mono',monospace}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes scan{0%{top:0}50%{top:calc(100% - 3px)}100%{top:0}}
@media (max-width:980px){.upload-grid,.review-grid,.scan-state,.review-hero{grid-template-columns:1fr}.review-hero{display:grid}.preview-meta{flex-direction:column;align-items:flex-start}}
@media (max-width:760px){.scan-topbar{grid-template-columns:1fr auto}.scan-brand{justify-self:start}.nav-meta{display:none}.hero-tags,.upload-actions,.review-actions{flex-direction:column}.hero-tag,.btn,.preview-meta .btn{width:100%}.field-grid{grid-template-columns:1fr}.hero-strip{grid-template-columns:1fr}}
@media (max-width:640px){.scan-shell{padding:18px 12px 94px}.surface,.scan-hero{padding:20px;border-radius:22px}.scan-hero h1,.scan-stage h2{font-size:34px}.scan-hero p{font-size:14px}.dropzone{min-height:260px}}
`;
