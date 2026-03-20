// src/services/gstEngine.ts
// GST calculation ka poora logic
// Koi bhi DB call nahi — pure math functions

// ── GST calculate karo ek item ke liye ──────────────────────
export function calculateTax(
  taxableValuePaise: number,  // amount in paise
  gstRate: number,            // 5, 12, 18, 28
  isIGST: boolean             // true = inter-state, false = same state
) {
  const totalTax = Math.round(taxableValuePaise * gstRate / 100);

  if (isIGST) {
    return {
      cgst: 0,
      sgst: 0,
      igst: totalTax,
      total: taxableValuePaise + totalTax,
    };
  }

  // Same state = CGST + SGST equal split
  const half = Math.round(totalTax / 2);
  return {
    cgst: half,
    sgst: totalTax - half, // odd paise handle karta hai
    igst: 0,
    total: taxableValuePaise + totalTax,
  };
}

// ── GSTIN valid hai ya nahi check karo ──────────────────────
export function validateGSTIN(gstin: string): boolean {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.toUpperCase());
}

// ── State code nikalo GSTIN se ──────────────────────────────
export function getStateFromGSTIN(gstin: string): string {
  const states: Record<string, string> = {
    "01": "Jammu & Kashmir",
    "07": "Delhi",
    "09": "Uttar Pradesh",
    "19": "West Bengal",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "33": "Tamil Nadu",
    "36": "Telangana",
    "06": "Haryana",
    "08": "Rajasthan",
    "03": "Punjab",
    "23": "Madhya Pradesh",
    "20": "Jharkhand",
    "21": "Odisha",
    "32": "Kerala",
  };
  const code = gstin.substring(0, 2);
  return states[code] ?? "Unknown State";
}

// ── Inter-state hai ya same state ───────────────────────────
export function isInterState(
  supplierGSTIN: string,
  buyerGSTIN: string
): boolean {
  return supplierGSTIN.substring(0, 2) !== buyerGSTIN.substring(0, 2);
}

// ── GST return ki due date nikalo ───────────────────────────
export function getDueDate(
  returnType: "GSTR1" | "GSTR3B" | "GSTR9",
  taxPeriod: string // format: "2025-03"
): string {
  const [year, month] = taxPeriod.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  if (returnType === "GSTR1") {
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}-11`;
  }
  if (returnType === "GSTR3B") {
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}-20`;
  }
  // GSTR9 = annual
  return `${year + 1}-12-31`;
}

// ── Paise ko rupees mein dikhao ─────────────────────────────
export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}