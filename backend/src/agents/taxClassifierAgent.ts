// src/agents/taxClassifierAgent.ts
// AI CA Tax & Expense Classifier Agent
// Uses Gemini Multimodal & Statutory Knowledge Engine to classify expenses and Section 17(5) blocked credits

import { knowledgeService } from "../services/knowledgeService.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface ExpenseClassificationResult {
  itemName: string;
  taxableAmount?: number;
  itcEligibility: "eligible" | "blocked" | "rcm_applicable";
  blockedSection?: string;
  confidence: number;
  explanation: string;
  recommendedAccountingLedger: string;
  statutoryReference: string;
}

export class TaxClassifierAgent {
  /**
   * Classify an expense description for GST ITC eligibility & accounting ledger
   */
  public async classifyExpense(
    itemDescription: string,
    taxableAmount: number = 0,
    vendorGstin?: string
  ): Promise<ExpenseClassificationResult> {
    // 1. Check deterministic statutory rules first
    const statutoryCheck = knowledgeService.checkBlockedCredit(itemDescription);

    // 2. If Gemini API is available, perform contextual AI reasoning
    if (GEMINI_API_KEY) {
      try {
        const prompt = `You are a Senior Indian Chartered Accountant (CA) and GST specialist.
Analyze this expense item for GST Input Tax Credit (ITC) eligibility:
Item Description: "${itemDescription}"
Taxable Amount: ₹${taxableAmount}
Vendor GSTIN: ${vendorGstin || "Not Provided"}

Evaluate based on:
1. Section 16(1) of CGST Act (furtherance of business).
2. Section 17(5) of CGST Act (Blocked credits: motor vehicles 17(5)(a), food/catering 17(5)(b)(i), club membership 17(5)(b)(ii), construction/works contract 17(5)(c)/(d), personal use 17(5)(g), gifts 17(5)(h)).
3. Reverse Charge Mechanism (RCM under Section 9(3)/9(4) for advocate fees, GTA, etc.).

Return a strict JSON object matching this schema:
{
  "itemName": "${itemDescription}",
  "itcEligibility": "eligible" | "blocked" | "rcm_applicable",
  "blockedSection": "Section 17(5)(b)(i)" | null,
  "confidence": 0.95,
  "explanation": "Clear explanation citing relevant GST Act section",
  "recommendedAccountingLedger": "e.g. Office Supplies / Staff Welfare / Legal Fees / Travel Expense",
  "statutoryReference": "CGST Act 2017 Section ..."
}`;

        const url = `${GEMINI_API_BASE}/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            return {
              itemName: itemDescription,
              taxableAmount,
              itcEligibility: parsed.itcEligibility || (statutoryCheck.isBlocked ? "blocked" : "eligible"),
              blockedSection: parsed.blockedSection || statutoryCheck.section,
              confidence: parsed.confidence || 0.9,
              explanation: parsed.explanation || statutoryCheck.reason || "Processed via AI CA Tax Engine",
              recommendedAccountingLedger: parsed.recommendedAccountingLedger || "General Expense",
              statutoryReference: parsed.statutoryReference || statutoryCheck.statutoryRef || "CGST Act 2017",
            };
          }
        }
      } catch (err) {
        console.warn("AI CA Gemini classification fallback to deterministic rules:", err);
      }
    }

    // Deterministic rule fallback
    return {
      itemName: itemDescription,
      taxableAmount,
      itcEligibility: statutoryCheck.isBlocked ? "blocked" : "eligible",
      blockedSection: statutoryCheck.section,
      confidence: 0.95,
      explanation: statutoryCheck.reason || "Eligible for ITC under Section 16(1)",
      recommendedAccountingLedger: statutoryCheck.isBlocked ? "Staff Welfare / Ineligible Expense" : "Direct Business Expense",
      statutoryReference: statutoryCheck.statutoryRef || "CGST Act 2017 Sec 16(1)",
    };
  }

  /**
   * Batch classify line items of an invoice
   */
  public async classifyInvoiceItems(
    items: Array<{ description: string; taxableValue: number }>
  ): Promise<ExpenseClassificationResult[]> {
    return Promise.all(
      items.map((item) => this.classifyExpense(item.description, item.taxableValue))
    );
  }
}

export const taxClassifierAgent = new TaxClassifierAgent();
