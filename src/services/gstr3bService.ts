// src/services/gstr3bService.ts
// GSTR-3B auto-computation service
// Net tax payable = Tax on Sales - ITC from Purchases

import { query } from "../lib/db.js";

// ── Types ─────────────────────────────────────────────────────
export interface GSTR3BSummary {
  tax_period: string;
  business_id: string;
  outward_supplies: {
    taxable_value: number;
    igst: number;
    cgst: number;
    sgst: number;
    total_tax: number;
  };
  inward_supplies: {
    taxable_value: number;
    igst: number;
    cgst: number;
    sgst: number;
    total_itc: number;
  };
  net_tax_payable: {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
  };
  totals_readable: {
    outward_tax: string;
    itc_available: string;
    net_payable: string;
  };
  due_date: string;
  status: "draft" | "ready_to_file" | "nil_return";
}

// ── Main function ─────────────────────────────────────────────
export async function computeGSTR3B(
  businessId: string,
  taxPeriod: string  // "2026-03"
): Promise<GSTR3BSummary> {

  const [year, month] = taxPeriod.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  // ── Step 1: Outward supplies (Sales) ─────────────────────────
  const salesResult = await query(
    `SELECT 
      COALESCE(SUM(taxable_value), 0) as taxable_value,
      COALESCE(SUM(igst_amount), 0)   as igst,
      COALESCE(SUM(cgst_amount), 0)   as cgst,
      COALESCE(SUM(sgst_amount), 0)   as sgst
     FROM invoices
     WHERE business_id = $1
       AND invoice_type = 'sale'
       AND invoice_date >= $2
       AND invoice_date <= $3
       AND is_cancelled = false`,
    [businessId, startDate, endDate]
  );

  const sales = salesResult.rows[0];
  const outwardTax =
    Number(sales.igst) + Number(sales.cgst) + Number(sales.sgst);

  // ── Step 2: Inward supplies (Purchases = ITC) ─────────────────
  const purchaseResult = await query(
    `SELECT 
      COALESCE(SUM(taxable_value), 0) as taxable_value,
      COALESCE(SUM(igst_amount), 0)   as igst,
      COALESCE(SUM(cgst_amount), 0)   as cgst,
      COALESCE(SUM(sgst_amount), 0)   as sgst
     FROM invoices
     WHERE business_id = $1
       AND invoice_type = 'purchase'
       AND invoice_date >= $2
       AND invoice_date <= $3
       AND is_cancelled = false`,
    [businessId, startDate, endDate]
  );

  const purchases = purchaseResult.rows[0];
  const totalITC =
    Number(purchases.igst) + Number(purchases.cgst) + Number(purchases.sgst);

  // ── Step 3: Net tax payable = Outward - ITC ───────────────────
  // ITC offset rule:
  // IGST ITC → first offset against IGST, then CGST, then SGST
  // CGST ITC → only offset against CGST
  // SGST ITC → only offset against SGST

  let igstPayable = Math.max(0, Number(sales.igst) - Number(purchases.igst));
  let cgstPayable = Math.max(0, Number(sales.cgst) - Number(purchases.cgst));
  let sgstPayable = Math.max(0, Number(sales.sgst) - Number(purchases.sgst));

  const netPayable = igstPayable + cgstPayable + sgstPayable;

  // ── Step 4: Due date ──────────────────────────────────────────
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const dueDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-20`;

  // ── Step 5: Status decide karo ────────────────────────────────
  let status: "draft" | "ready_to_file" | "nil_return";
  if (Number(sales.taxable_value) === 0 && Number(purchases.taxable_value) === 0) {
    status = "nil_return";
  } else {
    status = "ready_to_file";
  }

  // ── Step 6: DB mein save karo ─────────────────────────────────
  const summary = {
    outward_supplies: {
      taxable_value: Number(sales.taxable_value),
      igst: Number(sales.igst),
      cgst: Number(sales.cgst),
      sgst: Number(sales.sgst),
      total_tax: outwardTax,
    },
    inward_supplies: {
      taxable_value: Number(purchases.taxable_value),
      igst: Number(purchases.igst),
      cgst: Number(purchases.cgst),
      sgst: Number(purchases.sgst),
      total_itc: totalITC,
    },
    net_tax_payable: {
      igst: igstPayable,
      cgst: cgstPayable,
      sgst: sgstPayable,
      total: netPayable,
    },
  };

  await query(
    `INSERT INTO gst_returns
     (business_id, return_type, tax_period, status, summary_json, due_date)
     VALUES ($1, 'GSTR3B', $2, $3, $4, $5)
     ON CONFLICT (business_id, return_type, tax_period)
     DO UPDATE SET summary_json = $4, status = $3`,
    [businessId, taxPeriod, status, JSON.stringify(summary), dueDate]
  );

  // ── Step 7: Readable format ───────────────────────────────────
  const fmt = (p: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR"
    }).format(p / 100);

  return {
    tax_period: taxPeriod,
    business_id: businessId,
    ...summary,
    totals_readable: {
      outward_tax: fmt(outwardTax),
      itc_available: fmt(totalITC),
      net_payable: fmt(netPayable),
    },
    due_date: dueDate,
    status,
  };
}