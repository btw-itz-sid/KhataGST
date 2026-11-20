import "./Pricing.css";
import { useState, useEffect } from "react";
import { getToken } from "../lib/session";
import { BASE_URL } from "../lib/api";

type Route = "login" | "dashboard" | "scan" | "invoices" | "export" | "profile" | "pricing";

interface Props {
  navigate: (route: Route) => void;
}

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  accent: string;
  surface: string;
  badge?: string;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Starter",
    price: "₹0",
    period: "/month",
    tagline: "For micro businesses getting started with GST filing.",
    accent: "#18181b",
    surface: "#f4f4f5",
    features: [
      { text: "Up to 20 invoices/month", included: true },
      { text: "3 AI scans/month", included: true },
      { text: "GSTR-1 & GSTR-3B compute", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Single business", included: true },
      { text: "Email support", included: false },
      { text: "Priority AI processing", included: false },
      { text: "Multi-business support", included: false },
    ],
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Professional",
    price: "₹149",
    period: "/month",
    tagline: "For growing MSMEs who need unlimited scanning and faster filing.",
    accent: "#18181b",
    surface: "#f4f4f5",
    badge: "Most Popular",
    popular: true,
    features: [
      { text: "Unlimited invoices", included: true },
      { text: "Unlimited AI scans", included: true },
      { text: "GSTR-1 & GSTR-3B compute", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Up to 3 businesses", included: true },
      { text: "Email support", included: true },
      { text: "Priority AI processing", included: true },
      { text: "Multi-business support", included: false },
    ],
    cta: "Upgrade to Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "₹499",
    period: "/month",
    tagline: "For CA firms and multi-entity groups with advanced compliance needs.",
    accent: "#18181b",
    surface: "#f4f4f5",
    features: [
      { text: "Unlimited invoices", included: true },
      { text: "Unlimited AI scans", included: true },
      { text: "GSTR-1 & GSTR-3B compute", included: true },
      { text: "Excel & CSV export", included: true },
      { text: "Unlimited businesses", included: true },
      { text: "Priority email & phone", included: true },
      { text: "Priority AI processing", included: true },
      { text: "Dedicated onboarding", included: true },
    ],
    cta: "Upgrade to Enterprise",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can I switch plans anytime?",
    a: "Yes. You can upgrade or downgrade at any time. Changes apply from the next billing cycle.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We support UPI, debit/credit cards, and net banking via Razorpay.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Start on the free plan. Upgrade with Razorpay when you need more scans and return prep.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual plans are coming soon with a 20% discount over monthly billing.",
  },
];

const planMapping: Record<string, string> = {
  free: "free",
  basic: "pro",
  ca_pro: "enterprise",
};

export default function Pricing({ navigate }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Fetch user details to determine current subscription plan
    const token = getToken();
    if (token) {
      fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((payload) => {
          if (payload?.success && payload?.data?.plan) {
            setCurrentPlan(payload.data.plan);
          }
        })
        .catch(() => {});
    }

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function handleUpgrade(planId: string) {
    if (planId === "free") {
      navigate("dashboard");
      return;
    }

    const currentPlanId = planMapping[currentPlan] || "free";
    if (currentPlanId === planId) {
      alert("You are already on this plan!");
      return;
    }

    setLoading(true);
    setError(null);

    const token = getToken();
    if (!token) {
      setError("Please login to proceed with plan upgrade.");
      setLoading(false);
      return;
    }

    try {
      const backendPlan = planId === "pro" ? "basic" : "ca_pro";

      const res = await fetch(`${BASE_URL}/payments/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: backendPlan }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || "Order creation failed");
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "KhataGST",
        description: `Upgrade to ${planId === "pro" ? "Professional" : "Enterprise"} Plan`,
        order_id: data.order_id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: backendPlan,
              }),
            });

            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error?.message || "Payment verification failed");
            }

            setCurrentPlan(backendPlan);
            alert("Subscription activated successfully! 🚀");
            navigate("dashboard");
          } catch (err: any) {
            alert(`Payment verification failed: ${err.message}`);
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#ff6b00",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>


      <nav className="pr-topbar">
        <button className="pr-back" onClick={() => navigate("dashboard")}>
          Dashboard
        </button>
        <div className="pr-brand">
          Khata<span>GST</span>
        </div>
        <div className="pr-meta">Pricing</div>
      </nav>

      <div className="pr-shell">
        {error && <div className="pr-error-banner">{error}</div>}

        {/* Hero */}
        <section className="pr-hero">
          <div className="pr-hero-glow-a" />
          <div className="pr-hero-glow-b" />
          <div className="pr-hero-content">
            <div className="pr-kicker">Simple, Transparent Pricing</div>
            <h1>Choose the plan that fits your business</h1>
            <p>
              Start free with essential GST tools. Upgrade when you need
              unlimited AI scans, multi-business support, and priority
              processing.
            </p>
          </div>
        </section>

        {/* Plans Grid */}
        <section className="pr-plans-grid">
          {PLANS.map((plan) => {
            const isCurrent = planMapping[currentPlan] === plan.id;
            return (
              <article
                key={plan.id}
                className={`pr-plan ${plan.popular ? "pr-plan-popular" : ""}`}
              >
                {plan.popular && (
                  <div className="pr-plan-glow" />
                )}

                <div className="pr-plan-top">
                  {plan.badge && (
                    <span
                      className="pr-badge"
                      style={{ background: plan.accent, color: "#fff" }}
                    >
                      {plan.badge}
                    </span>
                  )}
                  <div
                    className="pr-plan-icon"
                    style={{ background: plan.surface, color: plan.accent }}
                  >
                    {plan.name.charAt(0)}
                  </div>
                  <h3 className="pr-plan-name">{plan.name}</h3>
                  <div className="pr-price-row">
                    <span className="pr-price">{plan.price}</span>
                    <span className="pr-period">{plan.period}</span>
                  </div>
                  <p className="pr-tagline">{plan.tagline}</p>
                </div>

                <div className="pr-divider" />

                <ul className="pr-features">
                  {plan.features.map((f) => (
                    <li
                      key={f.text}
                      className={f.included ? "pr-included" : "pr-excluded"}
                    >
                      <span className="pr-check">
                        {f.included ? "✓" : "—"}
                      </span>
                      {f.text}
                    </li>
                  ))}
                </ul>

                <button
                  className="pr-cta"
                  style={{
                    background: isCurrent ? "#f4f4f5" : plan.popular ? "#18181b" : "#fff",
                    color: isCurrent ? "#71717a" : plan.popular ? "#fff" : "#18181b",
                    border: "1px solid #e4e4e7",
                    boxShadow: "none",
                    cursor: isCurrent || loading ? "default" : "pointer",
                  }}
                  onClick={() => !isCurrent && !loading && handleUpgrade(plan.id)}
                  disabled={isCurrent || loading}
                >
                  {isCurrent ? "Current Plan" : loading ? "Loading..." : plan.cta}
                </button>
              </article>
            );
          })}
        </section>

        {/* FAQ */}
        <section className="pr-faq-section">
          <div className="pr-kicker" style={{ color: "#8a94a6" }}>
            Frequently Asked
          </div>
          <h2 className="pr-faq-title">Common questions</h2>

          <div className="pr-faq-list">
            {FAQ_ITEMS.map((item, idx) => (
              <button
                key={idx}
                aria-expanded={openFaq === idx}
                aria-controls={`faq-answer-${idx}`}
                className={`pr-faq ${openFaq === idx ? "pr-faq-open" : ""}`}
                onClick={() =>
                  setOpenFaq(openFaq === idx ? null : idx)
                }
              >
                <div className="pr-faq-q">
                  <strong>{item.q}</strong>
                  <span className="pr-faq-toggle">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </div>
                {openFaq === idx && (
                  <p id={`faq-answer-${idx}`} className="pr-faq-a">{item.a}</p>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="pr-cta-banner">
          <div>
            <h2>Ready to simplify your GST filing?</h2>
            <p>Start with the free plan today. No credit card required.</p>
          </div>
          <button
            className="pr-banner-btn"
            onClick={() => navigate("dashboard")}
          >
            Get Started
          </button>
        </section>
      </div>
    </>
  );
}
