// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — KhataGST ka Main Router
// Yahan sab routes manage hote hain: login, dashboard, scan, invoices, etc.
// Session check bhi yahan hota hai — agar token expired ho toh login pe redirect
// Bottom navigation bar bhi yahan render hota hai
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode } from "react";
import Admin from "./pages/Admin";
import "./styles/Navigation.css";
import Dashboard from "./pages/Dashboard";
import Returns from "./pages/Returns";
import Reconcile from "./pages/Reconcile";
import GSTRates from "./pages/GSTRates";
import Invoices from "./pages/Invoices";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Profile from "./pages/Profile";
import Scan from "./pages/Scan";
import AiCaCopilot from "./pages/AiCaCopilot";
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
import { BASE_URL, UNAUTHORIZED_EVENT } from "./lib/api";

// App ke andar sabhi possible routes
type Route =
  | "login"
  | "onboarding"
  | "admin"
  | "dashboard"
  | "scan"
  | "ai-ca"
  | "invoices"
  | "export"
  | "reconcile"
  | "gst-rates"
  | "profile"
  | "pricing"
  | "privacy"
  | "terms";

// BASE_URL comes from VITE_API_BASE_URL env var (defined in frontend/.env)
// → src/lib/api.ts

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
function SideNav({active,navigate}:{active:Route;navigate:(route:Route)=>void}) {
  const groups: {label:string;items:{route:Route;label:string;path:string}[]}[] = [
    {label:"WORKSPACE",items:[
      {route:"dashboard",label:"Overview",path:"M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7"},
      {route:"invoices",label:"Invoices",path:"M7 3h8l4 4v14H5V3h2M14 3v5h5M8 12h8M8 16h8"},
      {route:"scan",label:"Scan a bill",path:"M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8M12 8v8"},
      {route:"reconcile",label:"Reconciliation",path:"M4 7h15l-4-4M20 17H5l4 4M20 7v4M4 17v-4"},
      {route:"export",label:"Returns & exports",path:"M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"},
      {route:"ai-ca",label:"AI assistant",path:"m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3 2-6Z"}
    ]},
    {label:"MANAGE",items:[
      {route:"gst-rates",label:"GST rates",path:"M4 4h16v16H4V4M4 10h16M10 4v16M15 14h2M15 17h2"},
      {route:"pricing",label:"Plans & billing",path:"M3 5h18v14H3V5M3 10h18M7 15h3"},
      {route:"profile",label:"Settings",path:"M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0"}
    ]}
  ];
  return <aside className="workspace-sidebar" aria-label="Workspace navigation"><div className="workspace-logo">Khata<span>GST</span></div><nav>{groups.map(group=><div key={group.label}><p className="workspace-label">{group.label}</p><div className="workspace-links">{group.items.map(item=><button key={item.route} onClick={()=>navigate(item.route)} aria-current={active===item.route ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path}/></svg>{item.label}</button>)}</div></div>)}</nav><div className="workspace-sidebar-footer"><button onClick={()=>navigate("profile")}>Business settings</button><p>Clear books. Confident decisions.</p></div></aside>;
}

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
      route: "ai-ca",
      label: "AI CA",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      route: "export",
      label: "Returns",
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

  useEffect(() => {
    const labels: Partial<Record<Route,string>> = {dashboard:"Overview",invoices:"Invoices",scan:"Scan a bill","ai-ca":"AI assistant",export:"Returns",profile:"Settings",reconcile:"Reconciliation",pricing:"Plans","gst-rates":"GST rates",admin:"Administration",login:"Sign in",onboarding:"Business setup",privacy:"Privacy",terms:"Terms"};
    document.title = (labels[route] || "Workspace") + " | KhataGST";
    window.scrollTo({top:0,behavior:"instant"});
    const focus = requestAnimationFrame(() => { const heading=document.querySelector<HTMLElement>("#main-content h1, #main-content h2"); if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});} });
    return () => cancelAnimationFrame(focus);
  },[route]);

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

    function onUnauthorized() {
      if (!cancelled) setRoute("login");
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  // ── Navigate function — auth gaurd ke saath ───────────────────────────
  function navigate(nextRoute: Route) {
    const publicRoutes: Route[] = ["login", "privacy", "terms"];

    // Public legal pages — session optional
    if (publicRoutes.includes(nextRoute)) {
      setRoute(nextRoute);
      return;
    }

    // Agar session expire ho gayi toh login pe bhejo
    if (!hasValidSession()) {
      clearSession();
      setRoute("login");
      return;
    }

    // Agar onboarding pending hai (business nahi hai) toh pehle woh complete karo
    if (nextRoute !== "onboarding" && !getBusinessContext()?.id) {
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
          Khata<span style={{ color: "#71717a" }}>GST</span>
        </div>
        <div style={{
          width: 28, height: 28,
          borderRadius: "50%",
          border: "3px solid #e5e7eb",
          borderTopColor: "#18181b",
          animation: "spin .7s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // Login / legal / onboarding pe bottom nav nahi
  const showNav =
    route !== "login" &&
    route !== "onboarding" &&
    route !== "privacy" &&
    route !== "terms";

  return (
    // Bottom nav ke liye neeche padding do
    <div className={`app-shell ${showNav ? "has-navigation" : ""}`} data-screen={route}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {showNav && <SideNav active={route} navigate={navigate} />}
      <div id="main-content" tabIndex={-1}>

      {/* ── Login Page ─────────────────────────────────────────────── */}
      {route === "login" && (
        <Login
          onSuccess={handleLoginSuccess}
          onOpenPrivacy={() => setRoute("privacy")}
          onOpenTerms={() => setRoute("terms")}
        />
      )}

      {route === "privacy" && <Privacy navigate={navigate} />}
      {route === "terms" && <Terms navigate={navigate} />}

      {/* ── Onboarding — pehli baar business setup ─────────────────── */}
      {route === "onboarding" && (
        <>
        <Onboarding
          token={getToken()}
          onComplete={handleOnboardingComplete}
          onRequireLogin={handleLogout}
        />
        </>
      )}

      {/* ── Dashboard — main page ──────────────────────────────────── */}
      {route === "dashboard" && (
        <Dashboard navigate={navigate} onLogout={handleLogout} />
      )}

      {/* ── AI Invoice Scan ────────────────────────────────────────── */}
      {route === "scan" && (
        <Scan navigate={navigate} />
      )}

      {/* ── Autonomous AI CA Copilot ───────────────────────────────── */}
      {route === "ai-ca" && (
        <AiCaCopilot navigate={navigate} />
      )}

      {/* ── Invoice Register ───────────────────────────────────────── */}
      {route === "invoices" && (
        <Invoices navigate={navigate} />
      )}

      {/* ── GSTR Export ───────────────────────────────────────────── */}
      {route === "export" && (
        <Returns navigate={navigate} />
      )}

      {/* ── GSTR-2B Notice Prevention ─────────────────────────────── */}
      {route === "reconcile" && (
        <Reconcile navigate={navigate} />
      )}

      {/* ── Profile / Settings ────────────────────────────────────── */}
      {route === "profile" && (
        <Profile navigate={navigate} onLogout={handleLogout} />
      )}

      {/* ── GST Rate Master ────────────────────────────────────────– */}
      {route === "gst-rates" && (
        <GSTRates navigate={navigate} />
      )}

      {/* ── Admin Dashboard ────────────────────────────────────────– */}
      {route === "admin" && (
        <Admin navigate={navigate} />
      )}

      {/* ── Pricing Plans ─────────────────────────────────────────── */}
      {route === "pricing" && (
        <Pricing navigate={navigate} />
      )}

      {/* ── Bottom Navigation — sirf authenticated screens pe ──────── */}
      </div>
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
