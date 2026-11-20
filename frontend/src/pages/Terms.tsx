import "./Terms.css";
import { hasValidSession } from "../lib/session";
type Route = "profile" | "login" | "privacy" | "terms";

interface Props {
  navigate: (route: Route) => void;
}

export default function Terms({ navigate }: Props) {
  return (
    <>

      <header className="top">
        <button className="back" onClick={() => navigate(hasValidSession() ? "profile" : "login")}>← Back</button>
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
