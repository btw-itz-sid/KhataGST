import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Scan from "./pages/Scan";
import {
  clearBusinessContext,
  clearSession,
  getBusinessContext,
  getToken,
  hasValidSession,
  setAuthSession,
  setBusinessContext,
  type StoredBusinessContext,
} from "./lib/session";

type Route = "login" | "onboarding" | "dashboard" | "scan" | "invoices";

const BASE_URL = "/api/v1";

async function fetchPrimaryBusiness(
  token: string
): Promise<StoredBusinessContext | null | "unauthorized"> {
  try {
    const response = await fetch(`${BASE_URL}/businesses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => null);

    if (response.status === 401) return "unauthorized";
    if (!response.ok) return null;

    const business = payload?.businesses?.[0] ?? payload?.data?.[0] ?? null;
    if (!business?.id) return null;

    return {
      id: business.id,
      name: business.legal_name ?? business.trade_name ?? "",
    };
  } catch {
    return null;
  }
}

export function BottomNav({
  active,
  navigate,
}: {
  active: Route;
  navigate: (route: Route) => void;
}) {
  const items: { icon: string; label: string; route: Route }[] = [
    { icon: "Home", label: "Home", route: "dashboard" },
    { icon: "Docs", label: "Invoices", route: "invoices" },
    { icon: "Scan", label: "Scan", route: "scan" },
    { icon: "GST", label: "Returns", route: "dashboard" },
    { icon: "More", label: "Settings", route: "dashboard" },
  ];

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: #fff;
          border-top: 1px solid #e5e1d8;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
          z-index: 200;
        }
        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 10px 4px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.15s;
        }
        .nav-item.active { color: #ff6b00; }
        .nav-item:not(.active) { color: #a39b8e; }
        .nav-icon { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.3px; }
      `}</style>
      <nav className="bottom-nav">
        {items.map((item) => {
          const isActive =
            item.route === "dashboard"
              ? active === "dashboard"
              : active === item.route;

          return (
            <button
              key={item.label}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => navigate(item.route)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>("login");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      if (!hasValidSession()) {
        clearSession();
        if (!cancelled) {
          setRoute("login");
          setReady(true);
        }
        return;
      }

      const storedBusiness = getBusinessContext();
      if (storedBusiness?.id) {
        if (!cancelled) {
          setRoute("dashboard");
          setReady(true);
        }
        return;
      }

      const business = await fetchPrimaryBusiness(getToken());
      if (cancelled) return;

      if (business === "unauthorized") {
        clearSession();
        setRoute("login");
        setReady(true);
        return;
      }

      if (business) {
        setBusinessContext(business);
        setRoute("dashboard");
      } else {
        clearBusinessContext();
        setRoute("onboarding");
      }

      setReady(true);
    }

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  function navigate(nextRoute: Route) {
    if (nextRoute !== "login" && !hasValidSession()) {
      clearSession();
      setRoute("login");
      return;
    }

    if (
      nextRoute !== "login" &&
      nextRoute !== "onboarding" &&
      !getBusinessContext()?.id
    ) {
      setRoute("onboarding");
      return;
    }

    setRoute(nextRoute);
  }

  function handleLoginSuccess(
    token: string,
    business: StoredBusinessContext | null
  ) {
    setAuthSession(token);

    if (business) {
      setBusinessContext(business);
      setRoute("dashboard");
      return;
    }

    clearBusinessContext();
    setRoute("onboarding");
  }

  function handleOnboardingComplete(business: StoredBusinessContext) {
    setBusinessContext(business);
    setRoute("dashboard");
  }

  function handleLogout() {
    clearSession();
    setRoute("login");
  }

  if (!ready) return null;

  const showNav = route !== "login" && route !== "onboarding";

  return (
    <div style={{ paddingBottom: showNav ? "64px" : "0" }}>
      {route === "login" && <Login onSuccess={handleLoginSuccess} />}

      {route === "onboarding" && (
        <Onboarding
          token={getToken()}
          onComplete={handleOnboardingComplete}
          onRequireLogin={handleLogout}
        />
      )}

      {route === "dashboard" && (
        <Dashboard navigate={navigate} onLogout={handleLogout} />
      )}

      {route === "scan" && <Scan navigate={navigate} />}

      {route === "invoices" && <Invoices navigate={navigate} />}

      {showNav && <BottomNav active={route} navigate={navigate} />}
    </div>
  );
}
