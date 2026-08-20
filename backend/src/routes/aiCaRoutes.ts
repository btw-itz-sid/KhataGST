// src/routes/aiCaRoutes.ts
// AI Chartered Accountant (AI CA) API Routes
// Endpoints for Statutory Tax RAG, Expense Classification, and Invoice Compliance Audits

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../lib/db.js";
import { knowledgeService } from "../services/knowledgeService.js";
import { taxClassifierAgent } from "../agents/taxClassifierAgent.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function aiCaRoutes(app: FastifyInstance) {
  // All AI CA endpoints require authentication
  app.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Login karo pehle" },
      });
    }
  });

  // POST /api/v1/ai-ca/ask — AI CA Legal & Advisory Copilot (RAG)
  app.post("/ask", async (request, reply) => {
    const schema = z.object({
      question: z.string().min(3),
      business_id: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Question is required" },
      });
    }

    const { question } = parsed.data;

    try {
      // 1. Retrieve statutory knowledge chunks from RAG Layer
      const relevantChunks = await knowledgeService.search(question, 3);
      const knowledgeContext = relevantChunks
        .map(
          (c) =>
            `[${c.source_act} Section ${c.section_number} - ${c.section_title}]\n${c.content}`
        )
        .join("\n\n");

      // 2. Query Gemini LLM with Statutory Context
      if (GEMINI_API_KEY) {
        const systemPrompt = `You are KhataGST AI CA, a senior Indian Chartered Accountant, GST expert, and legal tax advisor.
Use the following statutory GST legal context to provide accurate, authoritative, and actionable advice.
Always cite the exact Act, Section, and Rules (e.g. CGST Act 2017 Section 16, Section 17(5), Rule 88A, Rule 86B).
Format with clear bullet points, risk warnings, and practical CA recommendations.

STATUTORY GST CONTEXT:
${knowledgeContext || "General CGST/SGST Acts and Rules apply."}

USER QUERY:
${question}`;

        const url = `${GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiReply) {
            return reply.send({
              success: true,
              answer: aiReply,
              statutoryCitations: relevantChunks.map((c) => ({
                act: c.source_act,
                section: c.section_number,
                title: c.section_title,
              })),
            });
          }
        }
      }

      // Fallback if LLM is unavailable: return structured statutory chunks directly
      const fallbackReply = relevantChunks.length > 0
        ? `Based on GST Statutory Law:\n\n${relevantChunks.map(c => `• **${c.section_title} (${c.source_act} Sec ${c.section_number})**:\n${c.content}`).join("\n\n")}`
        : "Please verify against the CGST Act 2017 or consult your assigned Chartered Accountant.";

      return reply.send({
        success: true,
        answer: fallbackReply,
        statutoryCitations: relevantChunks.map((c) => ({
          act: c.source_act,
          section: c.section_number,
          title: c.section_title,
        })),
      });
    } catch (err: any) {
      console.error("AI CA query error:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "AI_CA_ERROR", message: err.message || "Failed to process AI CA request" },
      });
    }
  });

  // POST /api/v1/ai-ca/classify-expense — Classify an expense for Section 17(5) blocked credit
  app.post("/classify-expense", async (request, reply) => {
    const schema = z.object({
      description: z.string().min(2),
      taxableAmount: z.number().optional().default(0),
      vendorGstin: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "description is required" },
      });
    }

    const { description, taxableAmount, vendorGstin } = parsed.data;

    try {
      const result = await taxClassifierAgent.classifyExpense(
        description,
        taxableAmount,
        vendorGstin
      );

      return reply.send({
        success: true,
        classification: result,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "CLASSIFICATION_FAILED", message: err.message },
      });
    }
  });

  // POST /api/v1/ai-ca/audit-invoice — Deep compliance audit on an invoice
  app.post("/audit-invoice", async (request, reply) => {
    const schema = z.object({
      invoice_id: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Valid invoice_id required" },
      });
    }

    const { invoice_id } = parsed.data;

    try {
      const invRes = await query(
        `SELECT i.*, p.name as party_name, p.gstin as party_gstin
         FROM invoices i
         LEFT JOIN parties p ON i.party_id = p.id
         WHERE i.id = $1`,
        [invoice_id]
      );

      if (invRes.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Invoice not found" },
        });
      }

      const invoice = invRes.rows[0];

      // Fetch invoice line items
      const itemsRes = await query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1`,
        [invoice_id]
      );
      const items = itemsRes.rows;

      // Run Section 17(5) and compliance audit on line items
      const itemAudits = await Promise.all(
        items.map(async (item: any) => {
          const classification = await taxClassifierAgent.classifyExpense(
            item.description,
            Number(item.taxable_value) / 100
          );
          return {
            itemId: item.id,
            description: item.description,
            hsn: item.hsn_sac,
            gstRate: item.gst_rate,
            taxableValuePaise: item.taxable_value,
            classification,
          };
        })
      );

      const hasBlockedItems = itemAudits.some(
        (i) => i.classification.itcEligibility === "blocked"
      );

      const complianceScore = hasBlockedItems ? 75 : 100;

      return reply.send({
        success: true,
        audit: {
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date,
          invoiceType: invoice.invoice_type,
          partyName: invoice.party_name,
          partyGstin: invoice.party_gstin,
          complianceScore,
          hasBlockedCredits: hasBlockedItems,
          recommendations: hasBlockedItems
            ? ["One or more line items fall under Section 17(5) blocked credit. Do not claim ITC in GSTR-3B Table 4(B)."]
            : ["All items are eligible for Input Tax Credit under Section 16(1)."],
          lineItemAudits: itemAudits,
        },
      });
    } catch (err: any) {
      console.error("Invoice audit failed:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "AUDIT_FAILED", message: err.message },
      });
    }
  });
}
