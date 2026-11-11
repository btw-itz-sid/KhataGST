// Compliance nudges before GSTR due dates — missing HSN, blocked ITC, 2B risk.

import { query } from "../lib/db.js";
import { summarizeRecon } from "./gstr2bReconcileService.js";

export type NudgeSeverity = "info" | "warn" | "critical";

export interface ComplianceNudge {
  id: string;
  severity: NudgeSeverity;
  title: string;
  detail: string;
  action?: string;
  metric?: string;
}

function currentTaxPeriod(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dueDates(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based current month = return for previous? MSMEs usually file previous month.
  // Nudges for the period being prepared: previous calendar month.
  const periodDate = new Date(y, m - 1, 1);
  const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
  const gstr1Due = new Date(y, m, 11); // 11th of current month for previous period
  const gstr3bDue = new Date(y, m, 20);
  return { period, gstr1Due, gstr3bDue };
}

function daysUntil(date: Date, now = new Date()): number {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86_400_000);
}

export async function buildComplianceNudges(
  businessId: string,
  taxPeriod?: string
): Promise<{ tax_period: string; days_to_gstr1: number; days_to_gstr3b: number; nudges: ComplianceNudge[] }> {
  const { period: defaultPeriod, gstr1Due, gstr3bDue } = dueDates();
  const period = taxPeriod || defaultPeriod;
  const nudges: ComplianceNudge[] = [];

  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const endDay = new Date(y, m, 0).getDate();
  const end = `${period}-${String(endDay).padStart(2, "0")}`;

  const missingHsn = await query(
    `SELECT COUNT(*)::int AS c
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.business_id = $1
        AND COALESCE(i.is_cancelled, FALSE) = FALSE
        AND i.invoice_date >= $2::date
        AND i.invoice_date <= $3::date
        AND (ii.hsn_sac IS NULL OR TRIM(ii.hsn_sac) = '')`,
    [businessId, start, end]
  );
  const missingHsnCount = Number(missingHsn.rows[0]?.c || 0);
  if (missingHsnCount > 0) {
    nudges.push({
      id: "missing_hsn",
      severity: "warn",
      title: `${missingHsnCount} line items missing HSN/SAC`,
      detail: "GSTR-1 rejects or notices often start with blank HSN. Fix before sharing with CA.",
      action: "invoices",
      metric: String(missingHsnCount),
    });
  }

  const blockedAsEligible = await query(
    `SELECT COUNT(*)::int AS c,
            COALESCE(SUM(COALESCE(i.cgst_amount,0)+COALESCE(i.sgst_amount,0)+COALESCE(i.igst_amount,0)),0)::bigint AS tax
       FROM invoices i
      WHERE i.business_id = $1
        AND i.invoice_type = 'purchase'
        AND COALESCE(i.is_cancelled, FALSE) = FALSE
        AND i.invoice_date >= $2::date
        AND i.invoice_date <= $3::date
        AND i.itc_eligibility = 'blocked'`,
    [businessId, start, end]
  );
  const blockedCount = Number(blockedAsEligible.rows[0]?.c || 0);
  const blockedTax = Number(blockedAsEligible.rows[0]?.tax || 0);
  if (blockedCount > 0) {
    nudges.push({
      id: "blocked_itc",
      severity: "critical",
      title: `₹${(blockedTax / 100).toLocaleString("en-IN")} blocked ITC (17(5))`,
      detail: `${blockedCount} purchase(s) marked blocked — claiming these invites notices.`,
      action: "invoices",
      metric: String(blockedTax),
    });
  }

  const recon = await query(
    `SELECT bucket, risk_paise
       FROM itc_recon_results
      WHERE business_id = $1 AND tax_period = $2`,
    [businessId, period]
  );
  if (recon.rows.length === 0) {
    nudges.push({
      id: "no_2b",
      severity: "warn",
      title: "GSTR-2B not reconciled yet",
      detail: "Upload 2B JSON before claiming ITC — unmatched purchases are DRC-01C fuel.",
      action: "reconcile",
    });
  } else {
    const summary = summarizeRecon(
      recon.rows.map((r: any) => ({
        bucket: r.bucket,
        supplier_gstin: "",
        invoice_number: "",
        books_taxable_paise: 0,
        portal_taxable_paise: 0,
        books_tax_paise: 0,
        portal_tax_paise: 0,
        difference_paise: 0,
        risk_paise: Number(r.risk_paise || 0),
        match_score: 0,
        notes: "",
      }))
    );
    if (summary.risk_paise > 0 || summary.mismatch > 0 || summary.in_books_not_2b > 0) {
      nudges.push({
        id: "2b_risk",
        severity: "critical",
        title: `₹${(summary.risk_paise / 100).toLocaleString("en-IN")} ITC at 2B risk`,
        detail: `${summary.mismatch} mismatch · ${summary.in_books_not_2b} not in 2B · ${summary.in_2b_not_books} missing in books`,
        action: "reconcile",
        metric: String(summary.risk_paise),
      });
    } else {
      nudges.push({
        id: "2b_clean",
        severity: "info",
        title: "2B reconcile looks clean",
        detail: "Matched rows only — still verify IMS accept with your CA.",
        action: "reconcile",
      });
    }
  }

  const purchaseNoGstin = await query(
    `SELECT COUNT(*)::int AS c
       FROM invoices i
       LEFT JOIN parties p ON p.id = i.party_id
      WHERE i.business_id = $1
        AND i.invoice_type = 'purchase'
        AND COALESCE(i.is_cancelled, FALSE) = FALSE
        AND i.invoice_date >= $2::date
        AND i.invoice_date <= $3::date
        AND (p.gstin IS NULL OR TRIM(p.gstin) = '')`,
    [businessId, start, end]
  );
  const noGstin = Number(purchaseNoGstin.rows[0]?.c || 0);
  if (noGstin > 0) {
    nudges.push({
      id: "purchase_no_gstin",
      severity: "info",
      title: `${noGstin} purchases without supplier GSTIN`,
      detail: "B2B ITC needs a valid GSTIN. Add party GSTIN or treat as B2C/URD carefully.",
      action: "invoices",
    });
  }

  const d1 = daysUntil(gstr1Due);
  const d3 = daysUntil(gstr3bDue);
  if (d1 <= 5 && d1 >= 0) {
    nudges.unshift({
      id: "gstr1_due",
      severity: d1 <= 2 ? "critical" : "warn",
      title: `GSTR-1 due in ${d1} day${d1 === 1 ? "" : "s"}`,
      detail: `Period ${period} — prepare outward supplies pack for your CA (KhataGST does not file).`,
      action: "export",
    });
  }
  if (d3 <= 7 && d3 >= 0) {
    nudges.unshift({
      id: "gstr3b_due",
      severity: d3 <= 3 ? "critical" : "warn",
      title: `GSTR-3B due in ${d3} day${d3 === 1 ? "" : "s"}`,
      detail: "Confirm eligible ITC only — blocked + not-in-2B must stay out.",
      action: "export",
    });
  }

  return {
    tax_period: period,
    days_to_gstr1: d1,
    days_to_gstr3b: d3,
    nudges,
  };
}
