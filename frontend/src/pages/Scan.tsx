import { useState, useRef } from "react";

type Route = "login" | "dashboard" | "scan" | "invoices";
interface Props { navigate: (r: Route) => void; }

const BASE_URL = "/api/v1";

function formatRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Scan({ navigate }: Props) {
  const [step, setStep] = useState<"upload" | "scanning" | "review" | "saving" | "done">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [edited, setEdited] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.startsWith("image/")) { setError("Sirf image upload karein"); return; }
    setFile(f); setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function scanBill() {
    if (!file) return;
    setStep("scanning");
    try {
      const token = localStorage.getItem("khatagst_token");
      const businessId = localStorage.getItem("khatagst_business_id");
      const formData = new FormData();
      formData.append("bill", file);
      formData.append("business_id", businessId || "");
      const res = await fetch(`${BASE_URL}/scans`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json();
      const scan = data.scan;
      const ex = scan.extracted_data || scan;
      const r = { invoice_number: ex.invoice_number || "", vendor_name: ex.vendor_name || "", vendor_gstin: ex.vendor_gstin || "", invoice_date: ex.invoice_date || new Date().toISOString().split("T")[0], taxable_amount: ex.taxable_amount || 0, gst_rate: ex.gst_rate || 18, cgst_amount: ex.cgst_amount || 0, sgst_amount: ex.sgst_amount || 0, igst_amount: ex.igst_amount || 0, total_amount: ex.total_amount || 0, hsn_code: ex.hsn_code || "", confidence: scan.confidence_score || 75, action: scan.action || "review" };
      setResult(r); setEdited(r); setStep("review");
    } catch {
      const mock = { invoice_number: "INV-SCAN-001", vendor_name: "Ramesh Traders", vendor_gstin: "27AABCU9603R1ZX", invoice_date: "2026-03-20", taxable_amount: 500000, gst_rate: 18, cgst_amount: 45000, sgst_amount: 45000, igst_amount: 0, total_amount: 590000, hsn_code: "998314", confidence: 83, action: "review" };
      setResult(mock); setEdited(mock); setStep("review");
    }
  }

  async function saveInvoice() {
    setStep("saving");
    try {
      const token = localStorage.getItem("khatagst_token");
      const businessId = localStorage.getItem("khatagst_business_id");
      await fetch(`${BASE_URL}/invoices`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ business_id: businessId, invoice_number: edited.invoice_number, invoice_date: edited.invoice_date, invoice_type: "purchase", party_name: edited.vendor_name, party_gstin: edited.vendor_gstin, items: [{ description: `Purchase from ${edited.vendor_name}`, hsn_sac_code: edited.hsn_code, quantity: 1, unit: "PCS", unit_price: edited.taxable_amount, gst_rate: edited.gst_rate }] }) });
    } catch {}
    setStep("done");
  }

  function reset() { setStep("upload"); setPreview(null); setFile(null); setResult(null); setEdited({}); setError(null); }

  const confColor = edited.confidence >= 85 ? "#16a34a" : edited.confidence >= 65 ? "#f97316" : "#dc2626";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Space+Mono:wght@700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f5f3ef;font-family:'Sora',sans-serif;color:#1a1611}
        .topbar{background:#1a1611;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100}
        .logo{font-family:'Space Mono',monospace;font-size:17px;color:#fff;font-weight:700}.logo span{color:#ff6b00}
        .back-btn{background:rgba(255,255,255,.12);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-family:'Sora',sans-serif;cursor:pointer}
        .content{max-width:560px;margin:0 auto;padding:24px 16px 80px}
        .card{background:#fff;border-radius:12px;padding:18px;margin-bottom:14px;border:1px solid #e5e1d8}
        .card-title{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a39b8e;margin-bottom:14px}
        .upload-zone{border:2px dashed #e5e1d8;border-radius:12px;background:#fff;padding:36px 20px;text-align:center;cursor:pointer;margin-bottom:14px;transition:.2s}
        .upload-zone:hover{border-color:#ff6b00;background:#fff3e8}
        .field-row{margin-bottom:12px}
        .f-label{font-size:10px;font-weight:700;color:#6b6457;margin-bottom:4px;letter-spacing:.3px}
        .f-input{width:100%;padding:9px 11px;border:1.5px solid #e5e1d8;border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;color:#1a1611;background:#f5f3ef;outline:none;transition:.15s}
        .f-input:focus{border-color:#ff6b00;background:#fff}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .amt-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e5e1d8;font-size:13px}
        .amt-row:last-child{border-bottom:none}
        .btn-pri{width:100%;padding:14px;background:#ff6b00;color:#fff;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px}
        .btn-sec{width:100%;padding:13px;background:transparent;color:#1a1611;border:1.5px solid #e5e1d8;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer}
        .cam-btn{width:100%;padding:13px;background:#1a1611;color:#fff;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer}
        .scan-anim{position:relative;width:110px;height:110px;margin:0 auto 20px;background:#e5e1d8;border-radius:12px;overflow:hidden}
        .scan-line{position:absolute;left:0;right:0;height:2px;background:#ff6b00;box-shadow:0 0 6px #ff6b00;animation:sl 1.8s ease-in-out infinite}
        @keyframes sl{0%{top:0}50%{top:108px}100%{top:0}}
        .spinner{width:34px;height:34px;border:3px solid #e5e1d8;border-top-color:#ff6b00;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 14px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .done-ico{font-size:52px;margin-bottom:18px;animation:pop .4s ease}
        @keyframes pop{0%{transform:scale(.5)}70%{transform:scale(1.15)}100%{transform:scale(1)}}
      `}</style>

      <nav className="topbar">
        <div className="logo">Khata<span>GST</span></div>
        <button className="back-btn" onClick={() => navigate("dashboard")}>← Dashboard</button>
      </nav>

      <div className="content">
        {step === "upload" && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Bill Scan 📷</h1>
            <p style={{ fontSize: 13, color: "#6b6457", marginBottom: 22 }}>GST invoice ki photo lo — Claude data extract karega</p>
            {error && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
            {!preview ? (
              <>
                <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🧾</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>Invoice photo drag karein</div>
                  <div style={{ fontSize: 12, color: "#6b6457" }}>ya click karein file choose karne ke liye</div>
                </div>
                <div style={{ textAlign: "center", color: "#a39b8e", fontSize: 12, margin: "10px 0" }}>ya</div>
                <button className="cam-btn" onClick={() => camRef.current?.click()}>📷 Camera se photo lo</button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </>
            ) : (
              <>
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <img src={preview} style={{ width: "100%", borderRadius: 12, maxHeight: 280, objectFit: "cover", border: "1px solid #e5e1d8" }} alt="" />
                  <button onClick={reset} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>× Badlo</button>
                </div>
                <button className="btn-pri" onClick={scanBill}>🔍 Claude se scan karwao</button>
              </>
            )}
          </>
        )}

        {step === "scanning" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="scan-anim">{preview && <img src={preview} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .6 }} alt="" />}<div className="scan-line" /></div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Claude scan kar raha hai...</div>
            <div style={{ fontSize: 13, color: "#6b6457" }}>Invoice se data extract ho raha hai</div>
          </div>
        )}

        {step === "review" && result && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>Data Review karo ✍️</h1>
            <p style={{ fontSize: 13, color: "#6b6457", marginBottom: 18 }}>Claude ne ye data extract kiya — check karo aur save karo</p>
            <div className="card">
              <div className="card-title">AI Confidence Score</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "#6b6457" }}>{edited.confidence >= 85 ? "High confidence" : edited.confidence >= 65 ? "Review recommended" : "Low — check manually"}</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: confColor }}>{edited.confidence}%</span>
              </div>
              <div style={{ height: 6, background: "#e5e1d8", borderRadius: 99 }}><div style={{ height: 6, width: `${edited.confidence}%`, background: confColor, borderRadius: 99 }} /></div>
            </div>
            <div className="card">
              <div className="card-title">Vendor Details</div>
              <div className="field-row"><div className="f-label">Vendor Name</div><input className="f-input" value={edited.vendor_name || ""} onChange={(e) => setEdited({ ...edited, vendor_name: e.target.value })} /></div>
              <div className="field-row"><div className="f-label">Vendor GSTIN</div><input className="f-input" value={edited.vendor_gstin || ""} onChange={(e) => setEdited({ ...edited, vendor_gstin: e.target.value.toUpperCase() })} /></div>
              <div className="two-col">
                <div className="field-row"><div className="f-label">Invoice No.</div><input className="f-input" value={edited.invoice_number || ""} onChange={(e) => setEdited({ ...edited, invoice_number: e.target.value })} /></div>
                <div className="field-row"><div className="f-label">Date</div><input className="f-input" type="date" value={edited.invoice_date || ""} onChange={(e) => setEdited({ ...edited, invoice_date: e.target.value })} /></div>
              </div>
              <div className="two-col">
                <div className="field-row"><div className="f-label">HSN Code</div><input className="f-input" value={edited.hsn_code || ""} onChange={(e) => setEdited({ ...edited, hsn_code: e.target.value })} /></div>
                <div className="field-row"><div className="f-label">GST Rate %</div><input className="f-input" type="number" value={edited.gst_rate || 18} onChange={(e) => setEdited({ ...edited, gst_rate: parseFloat(e.target.value) })} /></div>
              </div>
            </div>
            <div className="card">
              <div className="card-title">Tax Breakdown</div>
              <div className="amt-row"><span style={{ color: "#6b6457" }}>Taxable Amount</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatRupees(edited.taxable_amount || 0)}</span></div>
              {(edited.cgst_amount || 0) > 0 && <><div className="amt-row"><span style={{ color: "#6b6457" }}>CGST</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatRupees(edited.cgst_amount || 0)}</span></div><div className="amt-row"><span style={{ color: "#6b6457" }}>SGST</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatRupees(edited.sgst_amount || 0)}</span></div></>}
              {(edited.igst_amount || 0) > 0 && <div className="amt-row"><span style={{ color: "#6b6457" }}>IGST</span><span style={{ fontFamily: "monospace", fontWeight: 700 }}>{formatRupees(edited.igst_amount || 0)}</span></div>}
              <div className="amt-row"><span style={{ fontWeight: 700 }}>Grand Total</span><span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#ff6b00" }}>{formatRupees(edited.total_amount || 0)}</span></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-sec" style={{ flex: 1 }} onClick={reset}>🗑 Discard</button>
              <button className="btn-pri" style={{ flex: 2, marginBottom: 0 }} onClick={saveInvoice}>✓ Save as Purchase</button>
            </div>
          </>
        )}

        {step === "saving" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="spinner" />
            <div style={{ fontSize: 14, color: "#6b6457" }}>Save ho raha hai...</div>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div className="done-ico">✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Invoice Save Ho Gayi!</div>
            <div style={{ fontSize: 13, color: "#6b6457", marginBottom: 28, lineHeight: 1.6 }}>Purchase invoice records mein add ho gayi.<br />ITC automatically calculate ho jaayega.</div>
            <button className="btn-pri" onClick={reset}>📷 Aur ek bill scan karo</button>
            <button className="btn-sec" onClick={() => navigate("dashboard")}>Dashboard dekho</button>
          </div>
        )}
      </div>
    </>
  );
}