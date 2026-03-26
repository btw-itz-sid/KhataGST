import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import Export from "./pages/Export";
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

type Route =
  | "login"
  | "onboarding"
  | "dashboard"
  | "scan"
  | "invoices"
  | "export";

const BASE_URL = "/api/v1";

async function fetchPrimaryBusiness(
  token: string
): Promise<StoredBusinessContext | null | "unauthorized" | "error"> {
  try {
    const response = await fetch(`${BASE_URL}/businesses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (response.status === 401) return "unauthorized";
    
    const payload = await response.json().catch(() => null);
    if (!response.ok) return "error";

    const business = payload?.businesses?.[0] ?? payload?.data?.[0] ?? null;
    if (!business?.id) return null;

    return {
      id: business.id,
      name: business.legal_name ?? business.trade_name ?? "",
    };
  } catch {
    return "error";
  }
}

export function BottomNav({
  active,
  navigate,
}: {
  active: Route;
  navigate: (route: Route) => void;
}) {
  const items: {
    icon: "home" | "docs" | "scan" | "export" | "more";
    label: string;
    route: Route;
  }[] = [
    { icon: "home", label: "Home", route: "dashboard" },
    { icon: "docs", label: "Invoices", route: "invoices" },
    { icon: "scan", label: "Scan", route: "scan" },
    { icon: "export", label: "Export", route: "export" },
    { icon: "more", label: "Settings", route: "dashboard" },
  ];

  function NavIcon({
    kind,
  }: {
    kind: "home" | "docs" | "scan" | "export" | "more";
  }) {
    const commonProps = {
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.9,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
    };

    if (kind === "home") {
      return (
        <svg {...commonProps}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M9.5 20v-5.5h5V20" />
        </svg>
      );
    }

    if (kind === "docs") {
      return (
        <svg {...commonProps}>
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5V8h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );
    }

    if (kind === "scan") {
      return (
        <svg {...commonProps}>
          <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7" />
          <path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7" />
          <path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17" />
          <path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
    }

    if (kind === "export") {
      return (
        <svg {...commonProps}>
          <path d="M12 4v10" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
          <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5" />
        </svg>
      );
    }

    return (
      <svg {...commonProps}>
        <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          width: min(720px, calc(100% - 20px));
          display: flex;
          gap: 6px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid #dbe3ef;
          border-radius: 24px;
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
          backdrop-filter: blur(12px);
          z-index: 220;
        }
        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 6px;
          border-radius: 18px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.15s, background 0.15s, transform 0.15s;
        }
        .nav-item:hover { transform: translateY(-1px); }
        .nav-item.active {
          color: #ff6b00;
          background: #fff3e8;
        }
        .nav-item:not(.active) { color: #7b8798; }
        .nav-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.04);
        }
        .nav-item.active .nav-icon {
          background: rgba(255, 107, 0, 0.12);
        }
        .nav-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
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
              <span className="nav-icon">
                <NavIcon kind={item.icon} />
              </span>
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

      if (business === "unauthorized" || business === "error") {
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
    <div style={{ paddingBottom: showNav ? "96px" : "0" }}>
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

      {route === "export" && <Export navigate={navigate} />}

      {showNav && <BottomNav active={route} navigate={navigate} />}
    </div>
  );
}
