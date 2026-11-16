type Route = "login" | "privacy" | "terms";

interface Props {
  navigate: (route: Route) => void;
}

export default function Terms({ navigate }: Props) {
  return (
    <>
      <style>{STYLES}</style>
      <header className="top">
        <button className="back" onClick={() => navigate("login")}>← Back</button>
        <div className="brand">Khata<span>GST</span></div>
        <button className="back" onClick={() => navigate("privacy")}>Privacy</button>
      </header>
      <main className="page">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p className="meta">Last updated: 16 Nov 2026</p>

        <section>
          <h2>Service</h2>
          <p>
            KhataGST is a GST bookkeeping and return-preparation tool for Indian MSMEs. It helps you
            record sales/purchases, classify ITC risk, reconcile GSTR-2B uploads, and export packs for your CA.
          </p>
        </section>
        <section>
          <h2>Not a filing agent (yet)</h2>
          <p>
            Unless you later enable a licensed GSP connection, KhataGST does not submit GSTR-1/GSTR-3B
            to the GST portal and does not generate government ARNs. You (or your CA) remain responsible for filing.
          </p>
        </section>
        <section>
          <h2>Accuracy</h2>
          <p>
            Tax math is deterministic, but OCR extraction and ITC classification are assistive.
            Always review scanned bills and reconciliation results before claiming credit or filing.
          </p>
        </section>
        <section>
          <h2>Plans & limits</h2>
          <p>
            Free plan includes limited invoices and AI scans per month as shown on Pricing.
            Paid plans unlock higher limits after successful payment verification.
          </p>
        </section>
        <section>
          <h2>Acceptable use</h2>
          <p>
            Do not upload data you are not authorized to process, attempt to abuse OTP login,
            or use the product to fabricate statutory filings.
          </p>
        </section>
        <section>
          <h2>Account deletion</h2>
          <p>
            You may delete your account from Settings. Deletion is permanent and removes associated business data.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Support: <a href="mailto:support@khatagst.com">support@khatagst.com</a></p>
        </section>
      </main>
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700;800&family=JetBrains+Mono:wght@700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f8fafc;color:#0f172a;font-family:'DM Sans',sans-serif}
.top{position:sticky;top:0;display:flex;align-items:center;gap:12px;height:56px;padding:0 16px;background:#fff;border-bottom:1px solid #e2e8f0}
.brand{flex:1;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700}
.brand span{color:#ea580c}
.back{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:7px 10px;font-weight:600;cursor:pointer}
.page{max-width:720px;margin:0 auto;padding:28px 16px 80px}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}
h1{font-size:28px;font-weight:800;margin-bottom:8px}
.meta{font-size:13px;color:#64748b;margin-bottom:24px}
section{margin-bottom:20px}
h2{font-size:16px;font-weight:800;margin-bottom:8px}
p{font-size:14px;line-height:1.65;color:#334155}
a{color:#ea580c}
`;
