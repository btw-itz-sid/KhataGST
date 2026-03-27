import { useState } from "react";

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
    accent: "#64748b",
    surface: "rgba(100,116,139,.08)",
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
    price: "₹499",
    period: "/month",
    tagline: "For growing MSMEs who need unlimited scanning and faster filing.",
    accent: "#ff6b00",
    surface: "rgba(255,107,0,.08)",
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
    price: "₹1,499",
    period: "/month",
    tagline: "For CA firms and multi-entity groups with advanced compliance needs.",
    accent: "#8b5cf6",
    surface: "rgba(139,92,246,.08)",
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
    cta: "Contact Sales",
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
    a: "Yes — every new account gets a 14-day Pro trial with full access to unlimited scans.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual plans are coming soon with a 20% discount over monthly billing.",
  },
];

export default function Pricing({ navigate }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <style>{STYLES}</style>

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
          {PLANS.map((plan) => (
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
                  background: plan.popular
                    ? `linear-gradient(135deg, ${plan.accent}, #ea580c)`
                    : plan.surface,
                  color: plan.popular ? "#fff" : plan.accent,
                  boxShadow: plan.popular
                    ? `0 12px 28px ${plan.accent}33`
                    : "none",
                }}
                onClick={() => {
                  if (plan.id === "free") navigate("dashboard");
                }}
              >
                {plan.cta}
              </button>
            </article>
          ))}
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
                  <p className="pr-faq-a">{item.a}</p>
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

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@600;700&display=swap');
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at top left,rgba(255,107,0,.06),transparent 22%),linear-gradient(180deg,#f8fafc 0%,#eef3f9 100%);font-family:'Manrope',sans-serif;color:#0f172a}
button{font-family:inherit}

.pr-topbar{position:sticky;top:0;z-index:120;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(219,227,239,.9);background:rgba(248,250,252,.88);backdrop-filter:blur(14px)}
.pr-brand{justify-self:center;font:700 18px 'IBM Plex Mono',monospace}.pr-brand span{color:#ff6b00}
.pr-back{padding:10px 14px;border-radius:14px;background:rgba(15,23,42,.06);color:#0f172a;font-size:13px;font-weight:800;border:none;cursor:pointer;transition:transform .15s ease}
.pr-back:hover{transform:translateY(-1px)}
.pr-meta{justify-self:end;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a94a6}

.pr-shell{max-width:1100px;margin:0 auto;padding:26px 16px 94px;display:flex;flex-direction:column;gap:24px}

/* Hero */
.pr-hero{position:relative;overflow:hidden;padding:36px 32px;border-radius:28px;background:linear-gradient(135deg,#0f172a 0%,#172554 52%,#1e293b 100%);color:#fff;box-shadow:0 24px 56px rgba(15,23,42,.16);text-align:center;animation:prFade .5s ease both}
.pr-hero-glow-a,.pr-hero-glow-b{position:absolute;border-radius:50%;filter:blur(50px);pointer-events:none}
.pr-hero-glow-a{width:300px;height:300px;top:-80px;left:50%;transform:translateX(-50%);background:rgba(255,107,0,.2);animation:prFloat 7s ease-in-out infinite}
.pr-hero-glow-b{width:200px;height:200px;bottom:-60px;right:10%;background:rgba(139,92,246,.15);animation:prFloat 7s ease-in-out infinite;animation-delay:-3s}
@keyframes prFloat{0%,100%{opacity:.4;transform:translateY(0)}50%{opacity:.7;transform:translateY(-12px)}}
@keyframes prFade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.pr-hero-content{position:relative;z-index:2}
.pr-kicker{margin-bottom:12px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4)}
.pr-hero h1{margin:0;font-size:clamp(26px,4vw,40px);line-height:1.1;font-weight:800;letter-spacing:-.03em}
.pr-hero p{max-width:52ch;margin:16px auto 0;font-size:15px;line-height:1.8;color:rgba(255,255,255,.55)}

/* Plans Grid */
.pr-plans-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}
.pr-plan{position:relative;overflow:hidden;padding:24px;border-radius:24px;border:1px solid rgba(219,227,239,.9);background:rgba(255,255,255,.92);box-shadow:0 14px 32px rgba(15,23,42,.04);display:flex;flex-direction:column;gap:0;transition:transform .25s ease,box-shadow .25s ease;animation:prFade .5s ease both}
.pr-plan:hover{transform:translateY(-4px);box-shadow:0 20px 44px rgba(15,23,42,.08)}
.pr-plan-popular{border-color:rgba(255,107,0,.25);box-shadow:0 20px 48px rgba(255,107,0,.1)}
.pr-plan-glow{position:absolute;top:-60px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,107,0,.12),transparent 70%);pointer-events:none}

.pr-plan-top{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.pr-badge{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.pr-plan-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;font:800 20px 'IBM Plex Mono',monospace}
.pr-plan-name{font-size:20px;font-weight:800;color:#0f172a}
.pr-price-row{display:flex;align-items:baseline;gap:4px}
.pr-price{font:800 34px 'IBM Plex Mono',monospace;color:#0f172a}
.pr-period{font-size:14px;color:#8a94a6;font-weight:600}
.pr-tagline{margin:0;font-size:13px;line-height:1.7;color:#5f6c80}

.pr-divider{height:1px;margin:18px 0;background:rgba(219,227,239,.7)}

.pr-features{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;flex:1}
.pr-features li{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600}
.pr-included{color:#0f172a}
.pr-excluded{color:#b0b8c6}
.pr-check{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;font-size:12px;font-weight:800;flex-shrink:0}
.pr-included .pr-check{background:rgba(52,211,153,.1);color:#059669}
.pr-excluded .pr-check{background:rgba(148,163,184,.08);color:#b0b8c6}

.pr-cta{margin-top:20px;padding:14px 20px;border-radius:16px;border:none;font-size:14px;font-weight:800;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
.pr-cta:hover{transform:translateY(-2px)}

/* FAQ */
.pr-faq-section{display:flex;flex-direction:column;gap:14px}
.pr-faq-title{margin:0;font-size:24px;font-weight:800;letter-spacing:-.03em}
.pr-faq-list{display:flex;flex-direction:column;gap:8px}
.pr-faq{width:100%;text-align:left;padding:18px 20px;border-radius:18px;border:1px solid rgba(219,227,239,.9);background:rgba(255,255,255,.92);cursor:pointer;transition:border-color .2s ease,box-shadow .2s ease}
.pr-faq:hover{border-color:rgba(255,107,0,.15)}
.pr-faq-open{border-color:rgba(255,107,0,.2);box-shadow:0 6px 16px rgba(255,107,0,.04)}
.pr-faq-q{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pr-faq-q strong{font-size:14px;font-weight:800;color:#0f172a}
.pr-faq-toggle{width:28px;height:28px;display:grid;place-items:center;border-radius:10px;background:rgba(15,23,42,.05);font-size:16px;font-weight:800;color:#5f6c80;flex-shrink:0}
.pr-faq-a{margin:12px 0 0;font-size:13px;line-height:1.8;color:#5f6c80}

/* CTA Banner */
.pr-cta-banner{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 32px;border-radius:24px;background:linear-gradient(135deg,#0f172a 0%,#172554 52%,#1e293b 100%);color:#fff;box-shadow:0 18px 44px rgba(15,23,42,.14)}
.pr-cta-banner h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em}
.pr-cta-banner p{margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.5)}
.pr-banner-btn{padding:14px 28px;border-radius:16px;border:none;background:linear-gradient(135deg,#ff7a1a,#ea580c);color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 10px 24px rgba(234,88,12,.25);transition:transform .15s ease,box-shadow .15s ease;flex-shrink:0}
.pr-banner-btn:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(234,88,12,.35)}

/* Responsive */
@media (max-width:980px){.pr-plans-grid{grid-template-columns:1fr}}
@media (max-width:640px){.pr-shell{padding:18px 12px 94px}.pr-hero,.pr-plan,.pr-cta-banner{padding:20px;border-radius:20px}.pr-cta-banner{flex-direction:column;text-align:center}.pr-topbar{grid-template-columns:1fr auto}.pr-brand{justify-self:start}.pr-meta{display:none}}
`;
