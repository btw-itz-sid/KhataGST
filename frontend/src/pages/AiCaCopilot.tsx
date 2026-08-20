// frontend/src/pages/AiCaCopilot.tsx
// Autonomous AI Chartered Accountant (AI CA) Copilot Workspace
// Statutory Tax RAG Advisory, Section 17(5) Expense Classifier & Compliance Auditor

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
      text: "Namaste! I am your Autonomous AI Chartered Accountant (AI CA). I have full knowledge of the CGST/SGST Acts, CBIC circulars, Section 17(5) blocked credits, Rule 88A ITC set-off, and GST case laws. How can I assist your business today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  // Expense Classifier State
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<ClassificationResult | null>(null);

  const samplePrompts = [
    "Can I claim ITC on laptops bought for remote employees?",
    "Is GST paid on car insurance and repairs eligible for ITC?",
    "How does Rule 88A ITC set-off hierarchy work?",
    "What is the Rule 86B 1% cash ledger requirement?",
    "Do I need to pay GST under RCM for advocate legal fees?",
  ];

  const handleAsk = async (queryText?: string) => {
    const textToSend = queryText || question;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
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
            text: `⚠️ Error: ${data.error?.message || "Failed to retrieve CA advice."}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠️ Network error connecting to AI CA Engine.",
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-xl">⚖️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white">KhataGST AI CA</h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Statutory RAG Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Continuous Indian Tax Law & Statutory Decision Engine</p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("dashboard")}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
            >
              ← Dashboard
            </button>
            {/* Mode Switcher */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setActiveTab("advisor")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === "advisor"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Advisor
              </button>
              <button
                onClick={() => setActiveTab("classifier")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === "classifier"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sec 17(5)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "advisor" ? (
          <div className="space-y-6">
            {/* Quick Prompts */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAsk(prompt)}
                  className="whitespace-nowrap text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-full transition hover:border-emerald-500/40"
                >
                  💡 {prompt}
                </button>
              ))}
            </div>

            {/* Chat Thread */}
            <div className="space-y-4 min-h-[420px] bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-6 backdrop-blur">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    msg.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-slate-800/90 border border-slate-700 text-slate-200 rounded-bl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {/* Citations Box */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-1.5">
                        <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                          Statutory Citations & Legal References:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((cite, cIdx) => (
                            <span
                              key={cIdx}
                              className="inline-flex items-center gap-1 text-xs bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-300"
                            >
                              📜 {cite.act} Sec {cite.section}: {cite.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span>AI CA is consulting GST Acts & calculating rules...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any GST law, ITC rule, notice reply, or set-off question..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          /* Expense Classifier Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-1">Section 17(5) Expense Audit</h2>
              <p className="text-xs text-slate-400 mb-4">
                Verify if an inward supply is eligible for ITC or strictly blocked under the CGST Act.
              </p>

              <form onSubmit={handleClassify} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expense / Item Description
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="e.g. Annual car insurance, Team lunch catering, Office laptops"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Taxable Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isClassifying || !expenseDesc.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20"
                >
                  {isClassifying ? "Evaluating Statutory Rules..." : "Audit ITC Eligibility"}
                </button>
              </form>
            </div>

            {/* Results Panel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center">
              {classificationResult ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Classification Status</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        classificationResult.itcEligibility === "blocked"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : classificationResult.itcEligibility === "rcm_applicable"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {classificationResult.itcEligibility === "blocked"
                        ? "🚫 BLOCKED ITC"
                        : classificationResult.itcEligibility === "rcm_applicable"
                        ? "⚡ RCM APPLICABLE"
                        : "✅ ELIGIBLE ITC"}
                    </span>
                  </div>

                  {classificationResult.blockedSection && (
                    <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300">
                      <strong>Statutory Restriction:</strong> {classificationResult.blockedSection}
                    </div>
                  )}

                  <div className="space-y-2 text-xs">
                    <div className="text-slate-300">
                      <strong className="text-slate-400">CA Reason:</strong> {classificationResult.explanation}
                    </div>
                    <div className="text-slate-300">
                      <strong className="text-slate-400">Recommended Ledger:</strong>{" "}
                      <span className="text-emerald-400 font-mono">
                        {classificationResult.recommendedAccountingLedger}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      <strong className="text-slate-400">Legal Citation:</strong>{" "}
                      <span className="text-slate-200">{classificationResult.statutoryReference}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Enter an expense item on the left to run a real-time statutory ITC audit.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
