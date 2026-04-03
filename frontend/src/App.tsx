// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — KhataGST ka Main Router
// Yahan sab routes manage hote hain: login, dashboard, scan, invoices, etc.
// Session check bhi yahan hota hai — agar token expired ho toh login pe redirect
// Bottom navigation bar bhi yahan render hota hai
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from "react";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import Export from "./pages/Export";
import GSTRates from "./pages/GSTRates";
import Invoices from "./pages/Invoices";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
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

// App ke andar sabhi possible routes
type Route =
  | "login"
  | "onboarding"
  | "admin"
  | "dashboard"
  | "scan"
  | "invoices"
  | "export"
  | "gst-rates"
  | "profile"
  | "pricing";

// Backend base URL
const BASE_URL = "/api/v1";

// ── Business fetch karo session token se ──────────────────────────────────
// Returns: business context, null (no business = onboarding), "unauthorized", ya "error"
async function fetchPrimaryBusiness(
  token: string
): Promise<StoredBusinessContext | null | "unauthorized" | "error"> {
  try {
    const res = await fetch(`${BASE_URL}/businesses`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 401 = token invalid ya expired
    if (res.status === 401) return "unauthorized";

    const payload = await res.json().catch(() => null);
    if (!res.ok) return "error";

    // Pehla business lo agar hai toh
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

// ─────────────────────────────────────────────────────────────────────────────
// BottomNav — Fixed bottom navigation bar
// Sirf authenticated pages pe dikhta hai (login aur onboarding pe nahi)
// ─────────────────────────────────────────────────────────────────────────────
export function BottomNav({
  active,
  navigate,
}: {
  active: Route;
  navigate: (route: Route) => void;
}) {
  // Nav items — icon, label, aur route
  const items: { label: string; route: Route; icon: ReactNode }[] = [
    {
      route: "dashboard",
      label: "Home",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5"/>
          <path d="M5.5 9.5V20h13V9.5"/>
          <path d="M9.5 20v-5.5h5V20"/>
        </svg>
      ),
    },
    {
      route: "invoices",
      label: "Invoices",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/>
          <path d="M14 3.5V8h4"/>
          <path d="M9 12h6"/>
          <path d="M9 16h6"/>
        </svg>
      ),
    },
    {
      route: "scan",
      label: "Scan",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7"/>
          <path d="M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7"/>
          <path d="M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17"/>
          <path d="M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17"/>
          <path d="M12 8v8"/>
          <path d="M8 12h8"/>
        </svg>
      ),
    },
    {
      route: "export",
      label: "Export",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v10"/>
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>
          <path d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5"/>
        </svg>
      ),
    },
    {
      route: "profile",
      label: "Settings",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{NAV_STYLES}</style>
      {/* Fixed bottom navigation */}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {items.map((item) => {
          const isActive = active === item.route;
          return (
            <button
              key={item.route}
              className={`nav-btn ${isActive ? "nav-active" : ""} ${item.route === "scan" ? "nav-scan-btn" : ""}`}
              onClick={() => navigate(item.route)}
              aria-current={isActive ? "page" : undefined}
              id={`nav-${item.route}`}
            >
              {/* Scan button — center mein prominent dikhao */}
              {item.route === "scan" ? (
                <span className="nav-scan-icon">
                  {item.icon}
                </span>
              ) : (
                <span className={`nav-icon ${isActive ? "nav-icon-active" : ""}`}>{item.icon}</span>
              )}
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App Component — Router + Session hydration
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // Current route — default login
  const [route, setRoute] = useState<Route>("login");

  // App ready hai? (session check complete ho gaya?)
  const [ready, setReady] = useState(false);

  // ── App start hote hi session check karo ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      // Agar session expired ya nahi hai toh login pe bhejo
      if (!hasValidSession()) {
        clearSession();
        if (!cancelled) {
          setRoute("login");
          setReady(true);
        }
        return;
      }

      // Agar business already stored hai toh dashboard pe bhejo
      const stored = getBusinessContext();
      if (stored?.id) {
        if (!cancelled) {
          setRoute("dashboard");
          setReady(true);
        }
        return;
      }

      // Business info fetch karo token se
      const result = await fetchPrimaryBusiness(getToken());
      if (cancelled) return;

      // Token invalid — logout
      if (result === "unauthorized" || result === "error") {
        clearSession();
        setRoute("login");
        setReady(true);
        return;
      }

      // Business mila — dashboard pe jao
      if (result) {
        setBusinessContext(result);
        setRoute("dashboard");
      } else {
        // Koi business nahi — onboarding pe bhejo
        clearBusinessContext();
        setRoute("onboarding");
      }

      setReady(true);
    }

    hydrateSession();

    // Cleanup — agar component unmount ho jaaye
    return () => { cancelled = true; };
  }, []);

  // ── Navigate function — auth gaurd ke saath ───────────────────────────
  function navigate(nextRoute: Route) {
    // Agar session expire ho gayi toh login pe bhejo
    if (nextRoute !== "login" && !hasValidSession()) {
      clearSession();
      setRoute("login");
      return;
    }

    // Agar onboarding pending hai (business nahi hai) toh pehle woh complete karo
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

  // ── Login success handler ─────────────────────────────────────────────
  // Token save karo, business check karo, route decide karo
  function handleLoginSuccess(token: string, business: StoredBusinessContext | null) {
    setAuthSession(token);

    if (business) {
      setBusinessContext(business);
      setRoute("dashboard");
      return;
    }

    // Business nahi hai — onboarding
    clearBusinessContext();
    setRoute("onboarding");
  }

  // ── Onboarding complete handler ───────────────────────────────────────
  function handleOnboardingComplete(business: StoredBusinessContext) {
    setBusinessContext(business);
    setRoute("dashboard");
  }

  // ── Logout handler ────────────────────────────────────────────────────
  function handleLogout() {
    clearSession();
    setRoute("login");
  }

  // Session check ho raha hai — kuch mat dikhao
  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9fafb",
        flexDirection: "column",
        gap: 12,
      }}>
        {/* App load hote waqt brand dikhao */}
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 22,
          fontWeight: 700,
          color: "#111827",
        }}>
          Khata<span style={{ color: "#f97316" }}>GST</span>
        </div>
        <div style={{
          width: 28, height: 28,
          borderRadius: "50%",
          border: "3px solid #e5e7eb",
          borderTopColor: "#f97316",
          animation: "spin .7s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Login aur onboarding pe bottom nav nahi dikhana, admin aur gst-rates pe bhi nahi
  const showNav = route !== "login" && route !== "onboarding" && route !== "admin" && route !== "gst-rates";

  return (
    // Bottom nav ke liye neeche padding do
    <div style={{ paddingBottom: showNav ? "80px" : "0" }}>

      {/* ── Login Page ─────────────────────────────────────────────── */}
      {route === "login" && (
        <Login onSuccess={handleLoginSuccess} />
      )}

      {/* ── Onboarding — pehli baar business setup ─────────────────── */}
      {route === "onboarding" && (
        <Onboarding
          token={getToken()}
          onComplete={handleOnboardingComplete}
          onRequireLogin={handleLogout}
        />
      )}

      {/* ── Dashboard — main page ──────────────────────────────────── */}
      {route === "dashboard" && (
        <Dashboard navigate={navigate} onLogout={handleLogout} />
      )}

      {/* ── AI Invoice Scan ────────────────────────────────────────── */}
      {route === "scan" && (
        <Scan navigate={navigate} />
      )}

      {/* ── Invoice Register ───────────────────────────────────────── */}
      {route === "invoices" && (
        <Invoices navigate={navigate} />
      )}

      {/* ── GSTR Export ───────────────────────────────────────────── */}
      {route === "export" && (
        <Export navigate={navigate} />
      )}

      {/* ── Profile / Settings ────────────────────────────────────── */}
      {route === "profile" && (
        <Profile navigate={navigate} onLogout={handleLogout} />
      )}

      {/* ── GST Rate Master ────────────────────────────────────────– */}
      {route === "gst-rates" && (
        <GSTRates />
      )}

      {/* ── Admin Dashboard ────────────────────────────────────────– */}
      {route === "admin" && (
        <Admin />
      )}

      {/* ── Pricing Plans ─────────────────────────────────────────── */}
      {route === "pricing" && (
        <Pricing navigate={navigate} />
      )}

      {/* ── Bottom Navigation — sirf authenticated screens pe ──────── */}
      {showNav && (
        <BottomNav active={route} navigate={navigate} />
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV_STYLES — Bottom navigation ki styling
// Clean white bar with orange active states — no glassmorphism
// ─────────────────────────────────────────────────────────────────────────────
const NAV_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700&family=JetBrains+Mono:wght@700&display=swap');

/* ── Bottom Nav Container ────────────────────────────────────────────────── */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 8px 8px 8px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  /* Safe area for iPhone notch */
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

/* ── Individual Nav Button ───────────────────────────────────────────────── */
.nav-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  color: #9ca3af;
  min-height: 52px;
}

.nav-btn:hover:not(.nav-active) {
  background: #f9fafb;
  color: #6b7280;
}

/* ── Active State ────────────────────────────────────────────────────────── */
.nav-active {
  color: #f97316 !important;
}

.nav-active .nav-icon {
  background: #fff7ed;
  color: #f97316;
}

/* ── Nav Icon Container ──────────────────────────────────────────────────── */
.nav-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  transition: background 0.15s;
}

/* ── Scan Button — center mein specially styled ──────────────────────────── */
.nav-scan-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f97316;
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35);
  transition: all 0.15s;
  margin-bottom: 2px;
}

/* Scan button ka label bhi orange dikhao */
.nav-scan-btn {
  color: #f97316;
}

.nav-btn:hover .nav-scan-icon {
  background: #ea580c;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
}

/* ── Nav Label Text ──────────────────────────────────────────────────────── */
.nav-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}

/* ── Desktop — nav ko center mein rakho ─────────────────────────────────── */
@media (min-width: 640px) {
  .bottom-nav {
    max-width: 640px;
    left: 50%;
    transform: translateX(-50%);
    bottom: 12px;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    padding: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  }
}
`;
