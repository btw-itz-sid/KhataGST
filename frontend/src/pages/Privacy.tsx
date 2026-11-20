import "./Privacy.css";
import { hasValidSession } from "../lib/session";
type Route = "profile" | "login" | "privacy" | "terms";

interface Props {
  navigate: (route: Route) => void;
}

export default function Privacy({ navigate }: Props) {
  return (
    <>

      <header className="top">
        <button className="back" onClick={() => navigate(hasValidSession() ? "profile" : "login")}>← Back</button>
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
