type Route = "login" | "privacy" | "terms";

interface Props {
  navigate: (route: Route) => void;
}

export default function Privacy({ navigate }: Props) {
  return (
    <>
      <style>{STYLES}</style>
      <header className="top">
        <button className="back" onClick={() => navigate("login")}>← Back</button>
        <div className="brand">Khata<span>GST</span></div>
        <button className="back" onClick={() => navigate("terms")}>Terms</button>
      </header>
      <main className="page">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="meta">Last updated: 16 Nov 2026 · Applies to KhataGST web app</p>

        <section>
          <h2>What we collect</h2>
          <p>
            Phone number for login, business GSTIN and invoice/bookkeeping data you enter or scan,
            optional email for receipts, and basic device/session logs needed to keep the service secure.
          </p>
        </section>
        <section>
          <h2>How we use it</h2>
          <p>
            To provide GST books, ITC guidance, return-prep exports, and support. We do not sell your
            invoice data. AI scan features send bill images to our OCR provider only to extract fields you review.
          </p>
        </section>
        <section>
          <h2>What we do not do</h2>
          <p>
            KhataGST does not file returns on the GST portal for you unless a future licensed GSP
            integration is explicitly enabled. OTP SMS providers are used only when live SMS mode is turned on.
          </p>
        </section>
        <section>
          <h2>Storage & security</h2>
          <p>
            Data is stored in our database and, for bill scans, object storage when configured.
            Access is protected by phone OTP sessions. You can export your data from Returns and delete your account from Settings.
          </p>
        </section>
        <section>
          <h2>Your rights</h2>
          <p>
            You may request export or permanent deletion of your account. Deletion removes your businesses,
            invoices, scans, and reconciliation data associated with your login.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>Privacy questions: <a href="mailto:support@khatagst.com">support@khatagst.com</a></p>
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
