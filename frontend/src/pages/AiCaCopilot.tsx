import "./AiCaCopilot.css";
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
          <div className="page-eyebrow">ASK & REVIEW</div>
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

            <div className="chat-card" role="log" aria-live="polite" aria-label="Conversation with GST assistant">
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
                aria-label="Ask a GST question" className="composer-input"
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
