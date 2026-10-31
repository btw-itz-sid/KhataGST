// src/agents/taxClassifierAgent.ts
// AI CA Tax & Expense Classifier Agent
// Uses Gemini Multimodal & Statutory Knowledge Engine to classify expenses and Section 17(5) blocked credits

import { containsTerm, knowledgeService } from "../services/knowledgeService.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const RCM_TERMS = [
  "advocate",
  "lawyer",
  "legal fee",
  "gta",
  "goods transport",
  "reverse charge",
  "rcm",
];

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

export interface ItcDecision extends ExpenseClassificationResult {
  taxableAmountPaise: number;
  taxAmountPaise: number;
  claimablePaise: number;
  blockedPaise: number;
}

function looksLikeRcm(description: string): boolean {
  return RCM_TERMS.some((term) => containsTerm(description, term));
}

export function buildItcDecision(
  description: string,
  taxableAmountPaise = 0,
  taxAmountPaise = 0
): ItcDecision {
  const itemName = description.trim() || "Purchase";
  const taxable = Number.isFinite(taxableAmountPaise) ? Math.max(0, Math.round(taxableAmountPaise)) : 0;
  const tax = Number.isFinite(taxAmountPaise) ? Math.max(0, Math.round(taxAmountPaise)) : 0;

  if (looksLikeRcm(itemName)) {
    return {
      itemName,
      taxableAmount: taxable / 100,
      itcEligibility: "rcm_applicable",
      confidence: 0.9,
      explanation:
        "This looks like a reverse-charge supply (GTA, legal services, etc.). Pay the GST in cash first — do not claim ITC automatically.",
      recommendedAccountingLedger: "RCM Payable / Eligible after payment",
      statutoryReference: "CGST Act 2017 Sec 9(3)/9(4)",
      taxableAmountPaise: taxable,
      taxAmountPaise: tax,
      claimablePaise: 0,
      blockedPaise: 0,
    };
  }

  const statutoryCheck = knowledgeService.checkBlockedCredit(itemName);
  if (statutoryCheck.isBlocked) {
    return {
      itemName,
      taxableAmount: taxable / 100,
      itcEligibility: "blocked",
      blockedSection: statutoryCheck.section,
      confidence: 0.95,
      explanation: statutoryCheck.reason || "This expense is blocked from ITC under Section 17(5).",
      recommendedAccountingLedger: "Staff Welfare / Ineligible Expense",
      statutoryReference: statutoryCheck.statutoryRef || "CGST Act 2017 Sec 17(5)",
      taxableAmountPaise: taxable,
      taxAmountPaise: tax,
      claimablePaise: 0,
      blockedPaise: tax,
    };
  }

  return {
    itemName,
    taxableAmount: taxable / 100,
    itcEligibility: "eligible",
    confidence: 0.9,
    explanation: statutoryCheck.reason || "Eligible for ITC under Section 16(1).",
    recommendedAccountingLedger: "Direct Business Expense",
    statutoryReference: statutoryCheck.statutoryRef || "CGST Act 2017 Sec 16(1)",
    taxableAmountPaise: taxable,
    taxAmountPaise: tax,
    claimablePaise: tax,
    blockedPaise: 0,
  };
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
            const fallback = buildItcDecision(itemDescription, Math.round(taxableAmount * 100), 0);
            return {
              itemName: itemDescription,
              taxableAmount,
              itcEligibility: parsed.itcEligibility || fallback.itcEligibility,
              blockedSection: parsed.blockedSection || fallback.blockedSection,
              confidence: parsed.confidence || fallback.confidence,
              explanation: parsed.explanation || fallback.explanation,
              recommendedAccountingLedger: parsed.recommendedAccountingLedger || fallback.recommendedAccountingLedger,
              statutoryReference: parsed.statutoryReference || fallback.statutoryReference,
            };
          }
        }
      } catch (err) {
        console.warn("AI CA Gemini classification fallback to deterministic rules:", err);
      }
    }

    const fallback = buildItcDecision(itemDescription, Math.round(taxableAmount * 100), 0);
    return {
      itemName: fallback.itemName,
      taxableAmount,
      itcEligibility: fallback.itcEligibility,
      blockedSection: fallback.blockedSection,
      confidence: fallback.confidence,
      explanation: fallback.explanation,
      recommendedAccountingLedger: fallback.recommendedAccountingLedger,
      statutoryReference: fallback.statutoryReference,
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
