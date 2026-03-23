import * as fs from "fs";
import * as path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface ExtractedBillData {
  invoice_number: string;
  vendor_name: string;
  vendor_gstin: string;
  invoice_date: string;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  hsn_code: string;
  confidence: number;
  action: "auto" | "review" | "manual";
}

export function getScanAction(confidence: number): {
  action: "auto" | "review" | "manual";
} {
  if (confidence > 85) return { action: "auto" };
  if (confidence >= 65) return { action: "review" };
  return { action: "manual" };
}

export async function scanBillWithAI(imagePath: string): Promise<{
  extracted_data: ExtractedBillData;
  confidence_score: number;
  action: string;
  raw_response: string;
}> {
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  const prompt = `You are a GST invoice data extractor for Indian businesses. Extract ALL data from this GST invoice image.

Return ONLY a valid JSON object with NO extra text, NO markdown, NO backticks:
{
  "invoice_number": "invoice number or bill number",
  "vendor_name": "seller/supplier company name",
  "vendor_gstin": "15 character GSTIN of seller, empty string if not found",
  "invoice_date": "date in YYYY-MM-DD format",
  "taxable_amount": taxable value in PAISE (multiply rupees by 100),
  "gst_rate": GST percentage as number (5, 12, 18, or 28),
  "cgst_amount": CGST amount in PAISE (0 if IGST applies),
  "sgst_amount": SGST amount in PAISE (0 if IGST applies),
  "igst_amount": IGST amount in PAISE (0 if CGST/SGST applies),
  "total_amount": grand total in PAISE,
  "hsn_code": "HSN or SAC code, empty string if not found",
  "confidence": confidence score 0-100,
  "action": "auto" if confidence > 85, "review" if 65-85, "manual" if below 65
}

Important rules:
- All money values must be in PAISE (1 rupee = 100 paise)
- If intra-state: fill cgst_amount and sgst_amount, igst_amount = 0
- If inter-state: fill igst_amount, cgst_amount = 0, sgst_amount = 0
- Return ONLY the JSON, nothing else`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Clean and parse JSON
  const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const extracted: ExtractedBillData = JSON.parse(cleaned);

  return {
    extracted_data: extracted,
    confidence_score: extracted.confidence,
    action: extracted.action,
    raw_response: rawText,
  };
}
