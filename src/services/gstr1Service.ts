// src/services/gstr1Service.ts
// GSTR-1 auto-computation service
// Mahine ki saari sales invoices se GSTR-1 banata hai

import { query } from "../lib/db.js";

// ── Types ─────────────────────────────────────────────────────
export interface GSTR1Summary {
  tax_period: string;        // "2026-03"
  business_id: string;
  b2b: B2BInvoice[];         // GST registered buyers
  b2c: B2CSummary[];         // Unregistered buyers
  totals: {
    total_invoices: number;
    taxable_value: number;   // paise
    cgst: number;
    sgst: number;
    igst: number;
    total_tax: number;
    grand_total: number;
  };
  due_date: string;
  status: "draft" | "ready_to_file";
}

export interface B2BInvoice {
  buyer_gstin: string;
  buyer_name: string;
  invoice_number: string;
  invoice_date: string;
  place_of_supply: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  is_igst: boolean;
}

export interface B2CSummary {
  place_of_supply: string;
  gst_rate: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
}

// ── Main function ─────────────────────────────────────────────
export async function computeGSTR1(
  businessId: string,
  taxPeriod: string  // "2026-03"
): Promise<GSTR1Summary> {

  // Tax period se start/end date nikalo
  const [year, month] = taxPeriod.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0)
    .toISOString().split("T")[0]; // last day of month

  // Mahine ki saari sale invoices nikalo
  const invoicesResult = await query(
    `SELECT 
      i.*,
      p.gstin as buyer_gstin,
      p.name as buyer_name
     FROM invoices i
     LEFT JOIN parties p ON i.party_id = p.id
     WHERE i.business_id = $1
       AND i.invoice_type = 'sale'
       AND i.invoice_date >= $2
       AND i.invoice_date <= $3
       AND i.is_cancelled = false
     ORDER BY i.invoice_date ASC`,
    [businessId, startDate, endDate]
  );

  const invoices = invoicesResult.rows;

  // B2B aur B2C alag karo
  const b2bInvoices: B2BInvoice[] = [];
  const b2cMap = new Map<string, B2CSummary>();

  for (const inv of invoices) {
    if (inv.buyer_gstin) {
      // B2B — buyer ka GSTIN hai
      b2bInvoices.push({
        buyer_gstin: inv.buyer_gstin,
        buyer_name: inv.buyer_name ?? "Unknown",
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        place_of_supply: inv.place_of_supply ?? "",
        taxable_value: Number(inv.taxable_value),
        cgst: Number(inv.cgst_amount),
        sgst: Number(inv.sgst_amount),
        igst: Number(inv.igst_amount),
        total: Number(inv.total_amount),
        is_igst: inv.is_igst,
      });
    } else {
      // B2C — buyer ka GSTIN nahi hai
      // Rate wise group karo
      const itemsResult = await query(
        "SELECT * FROM invoice_items WHERE invoice_id = $1",
        [inv.id]
      );

      for (const item of itemsResult.rows) {
        const key = `${inv.place_of_supply}-${item.gst_rate}`;

        if (b2cMap.has(key)) {
          const existing = b2cMap.get(key)!;
          existing.taxable_value += Number(item.taxable_value);
          existing.cgst += Number(item.cgst_amount);
          existing.sgst += Number(item.sgst_amount);
          existing.igst += Number(item.igst_amount);
        } else {
          b2cMap.set(key, {
            place_of_supply: inv.place_of_supply ?? "",
            gst_rate: item.gst_rate,
            taxable_value: Number(item.taxable_value),
            cgst: Number(item.cgst_amount),
            sgst: Number(item.sgst_amount),
            igst: Number(item.igst_amount),
          });
        }
      }
    }
  }

  // Totals calculate karo
  const allInvoices = invoicesResult.rows;
  const totals = allInvoices.reduce((acc, inv) => ({
    total_invoices: acc.total_invoices + 1,
    taxable_value: acc.taxable_value + Number(inv.taxable_value),
    cgst: acc.cgst + Number(inv.cgst_amount),
    sgst: acc.sgst + Number(inv.sgst_amount),
    igst: acc.igst + Number(inv.igst_amount),
    total_tax: acc.total_tax + Number(inv.cgst_amount) +
               Number(inv.sgst_amount) + Number(inv.igst_amount),
    grand_total: acc.grand_total + Number(inv.total_amount),
  }), {
    total_invoices: 0,
    taxable_value: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total_tax: 0,
    grand_total: 0,
  });

  // Due date calculate karo
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const dueDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-11`;

  // DB mein save karo
  await query(
    `INSERT INTO gst_returns 
     (business_id, return_type, tax_period, status, summary_json, due_date)
     VALUES ($1, 'GSTR1', $2, 'computed', $3, $4)
     ON CONFLICT (business_id, return_type, tax_period)
     DO UPDATE SET summary_json = $3, status = 'computed'`,
    [
      businessId,
      taxPeriod,
      JSON.stringify({ b2b: b2bInvoices, b2c: Array.from(b2cMap.values()), totals }),
      dueDate
    ]
  );

  return {
    tax_period: taxPeriod,
    business_id: businessId,
    b2b: b2bInvoices,
    b2c: Array.from(b2cMap.values()),
    totals,
    due_date: dueDate,
    status: totals.total_invoices > 0 ? "ready_to_file" : "draft",
  };
}

// ── Paise ko rupees string mein convert karo ─────────────────
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}