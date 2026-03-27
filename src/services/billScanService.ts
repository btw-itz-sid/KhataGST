import * as fs from "fs";
import * as path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;
const BILL_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    invoice_number: { type: "string" },
    vendor_name: { type: "string" },
    vendor_gstin: { type: "string" },
    invoice_date: { type: "string" },
    taxable_amount: { type: "number" },
    gst_rate: { type: "number" },
    cgst_amount: { type: "number" },
    sgst_amount: { type: "number" },
    igst_amount: { type: "number" },
    total_amount: { type: "number" },
    hsn_code: { type: "string" },
    confidence: { type: "number" },
    action: {
      type: "string",
      enum: ["auto", "review", "manual"],
    },
  },
  required: [
    "invoice_number",
    "vendor_name",
    "vendor_gstin",
    "invoice_date",
    "taxable_amount",
    "gst_rate",
    "cgst_amount",
    "sgst_amount",
    "igst_amount",
    "total_amount",
    "hsn_code",
    "confidence",
    "action",
  ],
} as const;

interface GeminiModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
}

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

export interface ScanBillResult {
  extracted_data: ExtractedBillData;
  confidence_score: number;
  action: "auto" | "review" | "manual";
  raw_response: string;
  fallback_mode?: "manual_review";
  fallback_reason?: string;
}

export function getScanAction(confidence: number): {
  action: "auto" | "review" | "manual";
} {
  if (confidence > 85) return { action: "auto" };
  if (confidence >= 65) return { action: "review" };
  return { action: "manual" };
}

function normalizeModelName(model: string): string {
  return model.replace(/^models\//, "").trim();
}

function buildGenerateContentUrl(model: string): string {
  const normalizedModel = normalizeModelName(model);
  return `${GEMINI_API_BASE}/models/${normalizedModel}:generateContent?key=${GEMINI_API_KEY}`;
}

function getConfiguredModelCandidates(): string[] {
  const configured = process.env.GEMINI_MODEL
    ? [normalizeModelName(process.env.GEMINI_MODEL)]
    : [];

  return [...configured, ...DEFAULT_GEMINI_MODELS].filter(
    (model, index, all) => Boolean(model) && all.indexOf(model) === index
  );
}

async function listSupportedGeminiModels(): Promise<string[]> {
  const response = await fetch(`${GEMINI_API_BASE}/models?key=${GEMINI_API_KEY}`);
  if (!response.ok) {
    throw new Error(`Gemini models list failed with status ${response.status}`);
  }

  const payload = await response.json();
  const models = Array.isArray(payload?.models) ? payload.models : [];

  return models
    .filter((model: GeminiModelEntry) =>
      model.supportedGenerationMethods?.includes("generateContent")
    )
    .map((model: GeminiModelEntry) => normalizeModelName(model.name ?? ""))
    .filter(Boolean);
}

async function resolveGeminiModelCandidates(): Promise<string[]> {
  const configuredCandidates = getConfiguredModelCandidates();

  try {
    const availableModels = await listSupportedGeminiModels();
    const availableSet = new Set(availableModels);

    const preferredMatches = configuredCandidates.filter((model) =>
      availableSet.has(model)
    );
    if (preferredMatches.length > 0) {
      return preferredMatches;
    }

    const flashModels = availableModels.filter((model) => /flash/i.test(model));
    if (flashModels.length > 0) {
      return flashModels;
    }

    if (availableModels.length > 0) {
      return availableModels;
    }
  } catch {
    // Fall back to static model order if model discovery is unavailable.
  }

  return configuredCandidates;
}

function isModelUnavailable(status: number, errorText: string): boolean {
  return (
    status === 404 ||
    /not found|not supported for generateContent|unknown model/i.test(errorText)
  );
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

function repairLooseJson(text: string): string {
  return extractJsonObject(text)
    .replace(/^\uFEFF/, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '$1"$2":')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":')
    .replace(
      /:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g,
      (_match, value: string) =>
        `: ${JSON.stringify(value.replace(/\\'/g, "'"))}`
    )
    .replace(/,(\s*[}\]])/g, "$1")
    .trim();
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function normalizeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeInvoiceDate(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return raw;
}

function normalizeAction(value: unknown, confidence: number): "auto" | "review" | "manual" {
  if (value === "auto" || value === "review" || value === "manual") {
    return value;
  }

  return getScanAction(confidence).action;
}

function normalizeExtractedBillData(payload: unknown): ExtractedBillData {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI response object format mein nahi tha.");
  }

  const source = payload as Record<string, unknown>;
  const confidence = Math.max(0, Math.min(100, normalizeNumber(source.confidence)));

  return {
    invoice_number: normalizeString(source.invoice_number),
    vendor_name: normalizeString(source.vendor_name),
    vendor_gstin: normalizeString(source.vendor_gstin).toUpperCase(),
    invoice_date: normalizeInvoiceDate(source.invoice_date),
    taxable_amount: Math.round(normalizeNumber(source.taxable_amount)),
    gst_rate: normalizeNumber(source.gst_rate),
    cgst_amount: Math.round(normalizeNumber(source.cgst_amount)),
    sgst_amount: Math.round(normalizeNumber(source.sgst_amount)),
    igst_amount: Math.round(normalizeNumber(source.igst_amount)),
    total_amount: Math.round(normalizeNumber(source.total_amount)),
    hsn_code: normalizeString(source.hsn_code),
    confidence,
    action: normalizeAction(source.action, confidence),
  };
}

function parseExtractedBillData(rawText: string): ExtractedBillData {
  const attempts = [
    extractJsonObject(rawText),
    repairLooseJson(rawText),
  ];

  let lastError: Error | null = null;

  for (const candidate of attempts) {
    try {
      return normalizeExtractedBillData(JSON.parse(candidate));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw new Error(
    `AI response valid JSON nahi tha. ${lastError?.message ?? "Unknown parse error"}`
  );
}

export function createManualReviewFallback(reason: string): ScanBillResult {
  return {
    extracted_data: {
      invoice_number: "",
      vendor_name: "",
      vendor_gstin: "",
      invoice_date: "",
      taxable_amount: 0,
      gst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
      hsn_code: "",
      confidence: 0,
      action: "manual",
    },
    confidence_score: 0,
    action: "manual",
    raw_response: "",
    fallback_mode: "manual_review",
    fallback_reason: reason,
  };
}

export function shouldUseManualReviewFallback(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return /429|quota|rate limit|resource_exhausted|temporarily unavailable|service unavailable|overloaded|fetch failed|network|econnreset|etimedout/i.test(
    message
  );
}

export async function scanBillWithAI(imagePath: string): Promise<ScanBillResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key missing hai. GEMINI_API_KEY set karo.");
  }

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

  const modelCandidates = await resolveGeminiModelCandidates();
  let lastError = "";

  for (const model of modelCandidates) {
    const response = await fetch(buildGenerateContentUrl(model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      lastError = `Gemini API error (${model}): ${err}`;

      if (isModelUnavailable(response.status, err)) {
        continue;
      }

      throw new Error(lastError);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Gemini raw response:", rawText.substring(0, 500));

    if (!rawText) {
      throw new Error(`Gemini response empty aaya for model ${model}.`);
    }

    const extracted = parseExtractedBillData(rawText);

    return {
      extracted_data: extracted,
      confidence_score: extracted.confidence,
      action: extracted.action,
      raw_response: rawText,
    };
  }

  throw new Error(
    lastError ||
    "Gemini ke liye koi supported model nahi mila. GEMINI_MODEL ya API access check karo."
  );
}
