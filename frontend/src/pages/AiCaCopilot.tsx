// frontend/src/pages/AiCaCopilot.tsx
// AI CA Copilot — GST advisory chat + Section 17(5) expense classifier
// Styled to match KhataGST light / orange design system (no Tailwind)

import { useState } from "react";
import { getToken } from "../lib/session";
import { BASE_URL } from "../lib/api";

interface Citation {
  act: string;
  section: string;
  title: string;
}

interface Message {
  sender: "user" | "ai";
  text: string;
  citations?: Citation[];
  timestamp: string;
}

interface ClassificationResult {
  itemName: string;
  taxableAmount?: number;
  itcEligibility: "eligible" | "blocked" | "rcm_applicable";
  blockedSection?: string;
  confidence: number;
  explanation: string;
  recommendedAccountingLedger: string;
  statutoryReference: string;
}

export default function AiCaCopilot({
  navigate,
}: {
  navigate: (route: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"advisor" | "classifier">("advisor");
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Namaste! Main tumhara AI CA hoon — CGST/SGST Act, Section 17(5) blocked credit, Rule 88A set-off aur GST notices pe help kar sakta hoon. Kya poochna hai?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);

  const samplePrompts = [
    "Can I claim ITC on laptops for remote employees?",
    "Is GST on car insurance eligible for ITC?",
    "How does Rule 88A ITC set-off work?",
    "What is Rule 86B 1% cash ledger?",
    "RCM on advocate legal fees?",
  ];

  const handleAsk = async (queryText?: string) => {
    const textToSend = queryText || question;
    if (!textToSend.trim() || isLoading) return;

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setQuestion("");
    setIsLoading(true);

    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/ai-ca/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: textToSend }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: data.answer,
            citations: data.statutoryCitations,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: `Error: ${data.error?.message || "Failed to retrieve CA advice."}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Network error — AI CA Engine se connect nahi ho paya. Thodi der baad try karo.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || isClassifying) return;
    setIsClassifying(true);
    setClassificationResult(null);

    try {
      const token = getToken();
      const res = await fetch(`${BASE_URL}/ai-ca/classify-expense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: expenseDesc,
          taxableAmount: parseFloat(expenseAmount) || 0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setClassificationResult(data.classification);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClassifying(false);
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <header className="topbar">
        <button className="back-btn" onClick={() => navigate("dashboard")}>
          ← Home
        </button>
        <div className="topbar-brand">AI CA</div>
        <div className="tab-switch">
          <button
            className={activeTab === "advisor" ? "tab on" : "tab"}
            onClick={() => setActiveTab("advisor")}
          >
            Advisor
          </button>
          <button
            className={activeTab === "classifier" ? "tab on" : "tab"}
            onClick={() => setActiveTab("classifier")}
          >
            Sec 17(5)
          </button>
        </div>
      </header>

      <main className="page">
        <div className="hero-block">
          <div className="page-eyebrow">Statutory RAG</div>
          <h1 className="page-title">KhataGST AI CA</h1>
          <p className="page-desc">
            GST law questions with Act citations, plus a Section 17(5) ITC eligibility check for expenses.
          </p>
        </div>

        {activeTab === "advisor" ? (
          <div className="advisor">
            <div className="prompts">
              {samplePrompts.map((prompt) => (
                <button key={prompt} type="button" className="prompt-chip" onClick={() => handleAsk(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="chat-card">
              {messages.map((msg, idx) => (
                <div key={idx} className={`msg-row ${msg.sender === "user" ? "me" : "bot"}`}>
                  <div className={`bubble ${msg.sender === "user" ? "bubble-me" : "bubble-bot"}`}>
                    <div className="bubble-text">{msg.text}</div>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="cites">
                        <div className="cites-label">Statutory citations</div>
                        <div className="cite-list">
                          {msg.citations.map((cite, cIdx) => (
                            <span key={cIdx} className="cite">
                              {cite.act} §{cite.section} — {cite.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="msg-time">{msg.timestamp}</span>
                </div>
              ))}

              {isLoading && (
                <div className="typing">
                  <span className="dot" />
                  AI CA Act / Rules check kar raha hai…
                </div>
              )}
            </div>

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="GST law, ITC, notice, set-off…"
                className="composer-input"
              />
              <button
                type="submit"
                className="btn-pri"
                disabled={isLoading || !question.trim()}
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="classifier">
            <div className="card">
              <div className="card-title">Section 17(5) expense audit</div>
              <p className="card-copy">
                Check if an inward supply is eligible ITC, blocked, or RCM under the CGST Act.
              </p>
              <form onSubmit={handleClassify} className="class-form">
                <label className="field">
                  Expense / item
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="e.g. Car insurance, team lunch, office laptops"
                  />
                </label>
                <label className="field">
                  Taxable amount (₹)
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="25000"
                  />
                </label>
                <button
                  type="submit"
                  className="btn-pri full"
                  disabled={isClassifying || !expenseDesc.trim()}
                >
                  {isClassifying ? "Evaluating…" : "Audit ITC eligibility"}
                </button>
              </form>
            </div>

            <div className="card result-card">
              {classificationResult ? (
                <div className="result">
                  <div className="result-top">
                    <span className="card-title">Status</span>
                    <span
                      className={`status-pill ${
                        classificationResult.itcEligibility === "blocked"
                          ? "bad"
                          : classificationResult.itcEligibility === "rcm_applicable"
                            ? "warn"
                            : "ok"
                      }`}
                    >
                      {classificationResult.itcEligibility === "blocked"
                        ? "BLOCKED ITC"
                        : classificationResult.itcEligibility === "rcm_applicable"
                          ? "RCM APPLICABLE"
                          : "ELIGIBLE ITC"}
                    </span>
                  </div>

                  {classificationResult.blockedSection && (
                    <div className="warn-box">
                      <strong>Restriction:</strong> {classificationResult.blockedSection}
                    </div>
                  )}

                  <p><strong>CA reason:</strong> {classificationResult.explanation}</p>
                  <p>
                    <strong>Ledger:</strong>{" "}
                    <code>{classificationResult.recommendedAccountingLedger}</code>
                  </p>
                  <p><strong>Citation:</strong> {classificationResult.statutoryReference}</p>
                </div>
              ) : (
                <div className="empty-result">
                  Left side pe expense likho — real-time statutory ITC audit milega.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap');
*{box-sizing:border-box}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;height:56px;padding:0 14px;background:#fff;border-bottom:1px solid #e2e8f0}
.topbar-brand{flex:1;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px;color:#111827}
.back-btn{padding:7px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px;font-weight:600;cursor:pointer;color:#334155}
.tab-switch{display:flex;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:3px;gap:2px}
.tab{border:none;background:transparent;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;color:#64748b;cursor:pointer}
.tab.on{background:#ea580c;color:#fff}
.page{max-width:820px;margin:0 auto;padding:20px 16px 110px;display:flex;flex-direction:column;gap:16px;font-family:Inter,system-ui,sans-serif;color:#0f172a}
.hero-block{padding:4px 2px 2px}
.page-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.page-title{font-size:24px;font-weight:800;margin:0 0 6px;letter-spacing:-.02em}
.page-desc{font-size:14px;color:#64748b;line-height:1.55;margin:0;max-width:52ch}
.advisor{display:flex;flex-direction:column;gap:14px}
.prompts{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.prompt-chip{flex:0 0 auto;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:8px 12px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;font-size:12px;font-weight:600;color:#334155;cursor:pointer}
.prompt-chip:hover{border-color:#fb923c;color:#c2410c}
.chat-card{min-height:380px;max-height:min(58vh,520px);overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
.msg-row{display:flex;flex-direction:column;gap:4px}
.msg-row.me{align-items:flex-end}
.msg-row.bot{align-items:flex-start}
.bubble{max-width:88%;padding:12px 14px;border-radius:16px;font-size:14px;line-height:1.55}
.bubble-me{background:#ea580c;color:#fff;border-bottom-right-radius:6px}
.bubble-bot{background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;border-bottom-left-radius:6px}
.bubble-text{white-space:pre-wrap}
.cites{margin-top:10px;padding-top:10px;border-top:1px solid rgba(15,23,42,.08)}
.cites-label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.cite-list{display:flex;flex-wrap:wrap;gap:6px}
.cite{font-size:11px;font-weight:600;padding:4px 8px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;color:#475569}
.msg-time{font-size:10px;color:#94a3b8;padding:0 4px}
.typing{display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b}
.dot{width:8px;height:8px;border-radius:99px;background:#ea580c;animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
.composer{display:flex;gap:8px}
.composer-input{flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14px;background:#fff;outline:none}
.composer-input:focus{border-color:#fb923c;box-shadow:0 0 0 3px rgba(251,146,60,.18)}
.btn-pri{border:none;background:#ea580c;color:#fff;font-weight:700;font-size:13px;padding:12px 18px;border-radius:12px;cursor:pointer}
.btn-pri:hover{background:#c2410c}
.btn-pri:disabled{opacity:.5;cursor:not-allowed}
.btn-pri.full{width:100%}
.classifier{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px}
.card-title{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.card-copy{font-size:13px;color:#64748b;line-height:1.5;margin:0}
.class-form{display:flex;flex-direction:column;gap:12px}
.field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#64748b}
.field input{border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;color:#0f172a}
.field input:focus{outline:none;border-color:#fb923c}
.result-card{min-height:220px;justify-content:center}
.result{display:flex;flex-direction:column;gap:12px;font-size:13px;color:#334155;line-height:1.5}
.result-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.status-pill{font-size:11px;font-weight:800;padding:5px 10px;border-radius:999px}
.status-pill.ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
.status-pill.warn{background:#fffbeb;color:#92400e;border:1px solid #fcd34d}
.status-pill.bad{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.warn-box{padding:10px 12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:12px}
.result code{font-family:'JetBrains Mono',monospace;font-size:12px;color:#c2410c;background:#fff7ed;padding:2px 6px;border-radius:6px}
.empty-result{text-align:center;color:#94a3b8;font-size:13px;padding:28px 8px}
@media(max-width:720px){
  .classifier{grid-template-columns:1fr}
  .topbar-brand{font-size:13px}
  .tab{padding:6px 8px;font-size:11px}
  .chat-card{min-height:320px}
}
`;
