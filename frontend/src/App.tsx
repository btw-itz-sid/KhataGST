import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Scan from "./pages/Scan";
import Invoices from "./pages/Invoices";
import Onboarding from "./pages/Onboarding";

type Route = "login" | "onboarding" | "dashboard" | "scan" | "invoices";

function isLoggedIn(): boolean {
  const token = localStorage.getItem("khatagst_token");
  const expiry = localStorage.getItem("khatagst_token_expiry");
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry);
}

export function BottomNav({
  active,
  navigate,
}: {
  active: Route;
  navigate: (r: Route) => void;
}) {
  const items: { icon: string; label: string; route: Route }[] = [
    { icon: "🏠", label: "Home", route: "dashboard" },
    { icon: "📄", label: "Invoices", route: "invoices" },
    { icon: "📷", label: "Scan", route: "scan" },
    { icon: "📊", label: "Returns", route: "dashboard" },
    { icon: "⚙️", label: "Settings", route: "dashboard" },
  ];

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: white;
          border-top: 1px solid #e5e1d8;
          display: flex;
          box-shadow: 0 -4px 16px rgba(0,0,0,0.06);
          z-index: 200;
        }
        .nav-item {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          padding: 10px 4px 12px; cursor: pointer; gap: 3px;
          border: none; background: none; font-family: inherit;
          transition: color 0.15s;
        }
        .nav-item.active { color: #ff6b00; }
        .nav-item:not(.active) { color: #a39b8e; }
        .nav-icon { font-size: 18px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
      `}</style>
      <nav className="bottom-nav">
        {items.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${active === item.route && item.route !== "dashboard" || (active === "dashboard" && item.route === "dashboard") ? "active" : ""}`}
            onClick={() => navigate(item.route)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>("login");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      setRoute("dashboard");
    } else {
      localStorage.removeItem("khatagst_token");
      localStorage.removeItem("khatagst_token_expiry");
      localStorage.removeItem("khatagst_business_id");
      setRoute("login");
    }
    setReady(true);
  }, []);

  function navigate(r: Route) {
    if (r !== "login" && !isLoggedIn()) {
      setRoute("login");
      return;
    }
    setRoute(r);
  }

  function handleLoginSuccess(token: string, businessId: string) {
    localStorage.setItem("khatagst_token", token);
    localStorage.setItem("khatagst_business_id", businessId);
    localStorage.setItem(
      "khatagst_token_expiry",
      String(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );
    // Naya user → onboarding, purana user → dashboard
    if (!businessId) {
      setRoute("onboarding");
    } else {
      setRoute("dashboard");
    }
  }

  function handleLogout() {
    localStorage.removeItem("khatagst_token");
    localStorage.removeItem("khatagst_token_expiry");
    localStorage.removeItem("khatagst_business_id");
    setRoute("login");
  }

  if (!ready) return null;

  const showNav = route !== "login" && route !== "onboarding";

  return (
    <div style={{ paddingBottom: showNav ? "64px" : "0" }}>
      {route === "login" && (
        <Login onSuccess={handleLoginSuccess} />
      )}
      {route === "onboarding" && (
        <Onboarding
          token={localStorage.getItem("khatagst_token") || ""}
          onComplete={() => setRoute("dashboard")}
        />
      )}
      {route === "dashboard" && (
        <Dashboard navigate={navigate} onLogout={handleLogout} />
      )}
      {route === "scan" && (
        <Scan navigate={navigate} />
      )}
      {route === "invoices" && (
        <Invoices navigate={navigate} />
      )}

      {showNav && (
        <BottomNav active={route} navigate={navigate} />
      )}
    </div>
  );
}