// Enforce Pricing page claims: free = 20 invoices + 3 scans / calendar month.

import { query } from "../lib/db.js";

export type PlanCode = "free" | "basic" | "ca_pro";

export interface PlanLimits {
  plan: PlanCode;
  invoiceLimit: number | null; // null = unlimited
  scanLimit: number | null;
  invoicesUsed: number;
  scansUsed: number;
}

const FREE_INVOICE_LIMIT = 20;
const FREE_SCAN_LIMIT = 3;

function monthWindow(now = new Date()): { start: string; end: string; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${y}-${String(m + 1).padStart(2, "0")}`,
  };
}

export async function getUserPlan(userId: string): Promise<PlanCode> {
  const res = await query(`SELECT plan FROM users WHERE id = $1`, [userId]);
  const plan = String(res.rows[0]?.plan || "free") as PlanCode;
  if (plan === "basic" || plan === "ca_pro" || plan === "free") return plan;
  return "free";
}

export async function getPlanUsage(userId: string): Promise<PlanLimits> {
  const plan = await getUserPlan(userId);
  const { start, end } = monthWindow();

  const bizRes = await query(`SELECT id FROM businesses WHERE owner_id = $1`, [userId]);
  const bizIds = bizRes.rows.map((r: any) => r.id as string);

  let invoicesUsed = 0;
  let scansUsed = 0;

  if (bizIds.length > 0) {
    const inv = await query(
      `SELECT COUNT(*)::int AS c
         FROM invoices
        WHERE business_id = ANY($1::uuid[])
          AND created_at >= $2::timestamptz
          AND created_at < $3::timestamptz`,
      [bizIds, start, end]
    );
    invoicesUsed = Number(inv.rows[0]?.c || 0);

    const scans = await query(
      `SELECT COUNT(*)::int AS c
         FROM bill_scans
        WHERE business_id = ANY($1::uuid[])
          AND created_at >= $2::timestamptz
          AND created_at < $3::timestamptz`,
      [bizIds, start, end]
    );
    scansUsed = Number(scans.rows[0]?.c || 0);
  }

  if (plan === "free") {
    return {
      plan,
      invoiceLimit: FREE_INVOICE_LIMIT,
      scanLimit: FREE_SCAN_LIMIT,
      invoicesUsed,
      scansUsed,
    };
  }

  return {
    plan,
    invoiceLimit: null,
    scanLimit: null,
    invoicesUsed,
    scansUsed,
  };
}

export async function assertInvoiceAllowed(userId: string): Promise<PlanLimits> {
  const usage = await getPlanUsage(userId);
  if (usage.invoiceLimit != null && usage.invoicesUsed >= usage.invoiceLimit) {
    const err: any = new Error(
      `Free plan limit: ${usage.invoiceLimit} invoices/month. Upgrade to Pro for unlimited.`
    );
    err.code = "PLAN_LIMIT";
    err.usage = usage;
    throw err;
  }
  return usage;
}

export async function assertScanAllowed(userId: string): Promise<PlanLimits> {
  const usage = await getPlanUsage(userId);
  if (usage.scanLimit != null && usage.scansUsed >= usage.scanLimit) {
    const err: any = new Error(
      `Free plan limit: ${usage.scanLimit} AI scans/month. Upgrade to Pro for unlimited.`
    );
    err.code = "PLAN_LIMIT";
    err.usage = usage;
    throw err;
  }
  return usage;
}
