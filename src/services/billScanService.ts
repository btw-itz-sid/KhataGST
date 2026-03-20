// src/services/billScanService.ts
// MAIN AI FEATURE — Photo se bill ka data nikalna
// User photo leta hai → Claude AI padhta hai → structured data milta hai

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Ye prompt Claude ko deta hai ki bill se kya nikalna hai ──
const SCAN_PROMPT = `You are a GST invoice parser for Indian businesses.
Extract structured data from this invoice/bill image.

Return ONLY a valid JSON object — no explanation, no markdown:
{
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "seller_gstin": "15-char GSTIN or null",
  "seller_name": "string or null",
  "buyer_gstin": "string or null",
  "is_igst": false,
  "items": [
    {
      "description": "item name",
      "hsn_sac": "code or null",
      "quantity": 1,
      "unit": "NOS/KGS/MTR or null",
      "unit_price_paise": 0,
      "gst_rate": "18",
      "taxable_value_paise": 0
    }
  ],
  "taxable_value_paise": 0,
  "cgst_paise": 0,
  "sgst_paise": 0,
  "igst_paise": 0,
  "total_paise": 0,
  "confidence": 85
}

Important rules:
- All money in PAISE (rupees x 100). Example: Rs.1500 = 150000
- confidence: 0 to 100 (kitna sure hai tu)
- Unknown fields = null
- gst_rate must be: 0, 5, 12, 18, or 28
- is_igst = true only if IGST column visible`;

// ── Result ka type ───────────────────────────────────────────
export interface ScannedBill {
  invoice_number: string | null;
  invoice_date: string | null;
  seller_gstin: string | null;
  seller_name: string | null;
  buyer_gstin: string | null;
  is_igst: boolean;
  items: {
    description: string;
    hsn_sac: string | null;
    quantity: number;
    unit: string | null;
    unit_price_paise: number;
    gst_rate: string;
    taxable_value_paise: number;
  }[];
  taxable_value_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  confidence: number;
}

export interface ScanResult {
  success: boolean;
  data?: ScannedBill;
  error?: string;
}

// ── Main function — URL se bill scan karo ───────────────────
export async function scanBill(imageUrl: string): Promise<ScanResult> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0, // deterministic — same input = same output
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: imageUrl,
              },
            },
            {
              type: "text",
              text: SCAN_PROMPT,
            },
          ],
        },
      ],
    });

    // Response text nikalo
    const rawText =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    // Markdown code fence hata do agar ho
    const cleaned = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed: ScannedBill = JSON.parse(cleaned);

    // Basic validation
    if (typeof parsed.total_paise !== "number") {
      throw new Error("Bill se total amount nahi mila");
    }

    return { success: true, data: parsed };

  } catch (err: any) {
    console.error("❌ Bill scan failed:", err.message);
    return {
      success: false,
      error: err.message ?? "Bill scan mein error aaya",
    };
  }
}

// ── Confidence ke hisaab se action batao ────────────────────
// Frontend is function ko use karega UI decide karne ke liye
export function getScanAction(confidence: number): {
  action: "auto" | "review" | "manual";
  message: string;
} {
  if (confidence >= 80) {
    return {
      action: "auto",
      message: "Bill successfully scan hua! Details check karo.",
    };
  }
  if (confidence >= 60) {
    return {
      action: "review",
      message: "Bill scan hua lekin kuch details verify karo.",
    };
  }
  return {
    action: "manual",
    message: "Bill clearly nahi dikh raha. Please manually fill karo.",
  };
}