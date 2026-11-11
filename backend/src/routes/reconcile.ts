// GSTR-2B upload + ITC reconciliation + IMS accept/reject

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "crypto";
import { query } from "../lib/db.js";
import { canAccessBusiness } from "../lib/ownership.js";
import { logAuditEvent } from "../middleware/rbac.js";
import {
  parseGstr2bJson,
  reconcileBooksVs2b,
  summarizeRecon,
  type BooksInvoice,
  type PortalInvoice,
} from "../services/gstr2bReconcileService.js";

function periodBounds(taxPeriod: string): { start: string; end: string } {
  const [y, m] = taxPeriod.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

async function loadBooksPurchases(
  businessId: string,
  taxPeriod: string
): Promise<BooksInvoice[]> {
  const { start, end } = periodBounds(taxPeriod);
  const result = await query(
    `SELECT i.id,
            COALESCE(p.gstin, '') AS supplier_gstin,
            i.invoice_number,
            TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS invoice_date,
            i.taxable_value AS taxable_paise,
            (COALESCE(i.cgst_amount,0) + COALESCE(i.sgst_amount,0) + COALESCE(i.igst_amount,0)) AS tax_paise,
            i.total_amount AS total_paise,
            COALESCE(i.itc_eligibility, 'eligible') AS itc_eligibility
       FROM invoices i
       LEFT JOIN parties p ON p.id = i.party_id
      WHERE i.business_id = $1
        AND i.invoice_type = 'purchase'
        AND COALESCE(i.is_cancelled, FALSE) = FALSE
        AND i.invoice_date >= $2::date
        AND i.invoice_date <= $3::date
      ORDER BY i.invoice_date, i.invoice_number`,
    [businessId, start, end]
  );

  return result.rows.map((r: any) => ({
    id: r.id,
    supplier_gstin: String(r.supplier_gstin || "").toUpperCase(),
    invoice_number: String(r.invoice_number || ""),
    invoice_date: String(r.invoice_date || ""),
    taxable_paise: Number(r.taxable_paise || 0),
    tax_paise: Number(r.tax_paise || 0),
    total_paise: Number(r.total_paise || 0),
    itc_eligibility: r.itc_eligibility,
  }));
}

async function persistPortalRows(
  businessId: string,
  taxPeriod: string,
  userId: string,
  raw: unknown,
  invoices: PortalInvoice[]
): Promise<{ importId: string; rowIds: string[] }> {
  const importId = randomUUID();
  await query(
    `INSERT INTO gstr2b_imports (id, business_id, tax_period, source, raw_json, imported_by, row_count)
     VALUES ($1, $2, $3, 'json_upload', $4::jsonb, $5, $6)`,
    [importId, businessId, taxPeriod, JSON.stringify(raw), userId, invoices.length]
  );

  // Replace prior portal rows for this period (latest upload wins)
  await query(
    `DELETE FROM gstr2b_rows WHERE business_id = $1 AND tax_period = $2`,
    [businessId, taxPeriod]
  );

  const rowIds: string[] = [];
  for (const inv of invoices) {
    const id = randomUUID();
    rowIds.push(id);
    await query(
      `INSERT INTO gstr2b_rows (
         id, import_id, business_id, tax_period, supplier_gstin, supplier_name,
         invoice_number, invoice_date, taxable_paise, cgst_paise, sgst_paise,
         igst_paise, cess_paise, total_paise, ims_action
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,'pending')`,
      [
        id,
        importId,
        businessId,
        taxPeriod,
        inv.supplier_gstin || null,
        inv.supplier_name || null,
        inv.invoice_number,
        inv.invoice_date || null,
        inv.taxable_paise,
        inv.cgst_paise,
        inv.sgst_paise,
        inv.igst_paise,
        inv.cess_paise,
        inv.total_paise,
      ]
    );
  }

  return { importId, rowIds };
}

async function persistReconResults(
  businessId: string,
  taxPeriod: string,
  runId: string,
  portalRowIds: string[],
  rows: ReturnType<typeof reconcileBooksVs2b>
) {
  await query(
    `DELETE FROM itc_recon_results WHERE business_id = $1 AND tax_period = $2`,
    [businessId, taxPeriod]
  );

  for (const row of rows) {
    const gstr2bRowId =
      row.portal_index != null ? portalRowIds[row.portal_index] ?? null : null;
    await query(
      `INSERT INTO itc_recon_results (
         business_id, tax_period, run_id, bucket, our_invoice_id, gstr2b_row_id,
         supplier_gstin, invoice_number, books_taxable_paise, portal_taxable_paise,
         books_tax_paise, portal_tax_paise, difference_paise, risk_paise, match_score, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        businessId,
        taxPeriod,
        runId,
        row.bucket,
        row.our_invoice_id || null,
        gstr2bRowId,
        row.supplier_gstin || null,
        row.invoice_number || null,
        row.books_taxable_paise,
        row.portal_taxable_paise,
        row.books_tax_paise,
        row.portal_tax_paise,
        row.difference_paise,
        row.risk_paise,
        row.match_score,
        row.notes,
      ]
    );
  }
}

export async function reconcileRoutes(app: FastifyInstance) {
  // POST /api/v1/reconcile/2b/upload
  app.post("/2b/upload", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId as string;
    const body = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/),
      gstr2b: z.any(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id, tax_period, aur gstr2b JSON do" },
      });
    }

    const { business_id, tax_period, gstr2b } = body.data;
    if (!(await canAccessBusiness(business_id, userId))) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    let parsed;
    try {
      parsed = parseGstr2bJson(gstr2b);
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: { code: "BAD_2B_JSON", message: err.message || "GSTR-2B parse fail" },
      });
    }

    const period = tax_period;
    const books = await loadBooksPurchases(business_id, period);
    const { importId, rowIds } = await persistPortalRows(
      business_id,
      period,
      userId,
      gstr2b,
      parsed.invoices
    );

    const runId = randomUUID();
    const matches = reconcileBooksVs2b(books, parsed.invoices);
    await persistReconResults(business_id, period, runId, rowIds, matches);
    const summary = summarizeRecon(matches);

    await logAuditEvent({
      userId,
      businessId: business_id,
      action: "gstr2b.upload_reconcile",
      entityType: "gstr2b_import",
      entityId: importId,
      details: { tax_period: period, ...summary },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return {
      success: true,
      import_id: importId,
      run_id: runId,
      tax_period: period,
      summary,
      message: summary.risk_paise > 0
        ? `Notice risk ~₹${(summary.risk_paise / 100).toLocaleString("en-IN")} — claim se pehle fix karo`
        : "2B reconcile clean dikhta hai",
    };
  });

  // GET /api/v1/reconcile/2b?business_id=&tax_period=
  app.get("/2b", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId as string;
    const q = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/),
    }).safeParse(request.query);

    if (!q.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do" },
      });
    }

    const { business_id, tax_period } = q.data;
    if (!(await canAccessBusiness(business_id, userId))) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const results = await query(
      `SELECT r.*,
              g.ims_action, g.ims_note, g.supplier_name AS portal_supplier_name,
              g.invoice_date AS portal_invoice_date
         FROM itc_recon_results r
         LEFT JOIN gstr2b_rows g ON g.id = r.gstr2b_row_id
        WHERE r.business_id = $1 AND r.tax_period = $2
        ORDER BY
          CASE r.bucket
            WHEN 'mismatch' THEN 1
            WHEN 'in_books_not_2b' THEN 2
            WHEN 'in_2b_not_books' THEN 3
            ELSE 4
          END,
          r.risk_paise DESC`,
      [business_id, tax_period]
    );

    const portal = await query(
      `SELECT id, supplier_gstin, supplier_name, invoice_number, invoice_date,
              taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
              ims_action, ims_note
         FROM gstr2b_rows
        WHERE business_id = $1 AND tax_period = $2
        ORDER BY invoice_date NULLS LAST, invoice_number`,
      [business_id, tax_period]
    );

    const summary = summarizeRecon(
      results.rows.map((r: any) => ({
        bucket: r.bucket,
        supplier_gstin: r.supplier_gstin || "",
        invoice_number: r.invoice_number || "",
        books_taxable_paise: Number(r.books_taxable_paise || 0),
        portal_taxable_paise: Number(r.portal_taxable_paise || 0),
        books_tax_paise: Number(r.books_tax_paise || 0),
        portal_tax_paise: Number(r.portal_tax_paise || 0),
        difference_paise: Number(r.difference_paise || 0),
        risk_paise: Number(r.risk_paise || 0),
        match_score: Number(r.match_score || 0),
        notes: r.notes || "",
      }))
    );

    return {
      success: true,
      tax_period,
      summary,
      results: results.rows,
      portal_rows: portal.rows,
    };
  });

  // POST /api/v1/reconcile/2b/recompute
  app.post("/2b/recompute", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId as string;
    const body = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do" },
      });
    }

    const { business_id, tax_period } = body.data;
    if (!(await canAccessBusiness(business_id, userId))) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const portalRes = await query(
      `SELECT * FROM gstr2b_rows WHERE business_id = $1 AND tax_period = $2 ORDER BY created_at`,
      [business_id, tax_period]
    );
    if (portalRes.rows.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_2B", message: "Pehle GSTR-2B JSON upload karo" },
      });
    }

    const portal: PortalInvoice[] = portalRes.rows.map((r: any) => ({
      supplier_gstin: r.supplier_gstin || "",
      supplier_name: r.supplier_name || undefined,
      invoice_number: r.invoice_number,
      invoice_date: r.invoice_date
        ? String(r.invoice_date).slice(0, 10)
        : null,
      taxable_paise: Number(r.taxable_paise || 0),
      cgst_paise: Number(r.cgst_paise || 0),
      sgst_paise: Number(r.sgst_paise || 0),
      igst_paise: Number(r.igst_paise || 0),
      cess_paise: Number(r.cess_paise || 0),
      total_paise: Number(r.total_paise || 0),
    }));
    const rowIds = portalRes.rows.map((r: any) => r.id as string);
    const books = await loadBooksPurchases(business_id, tax_period);
    const runId = randomUUID();
    const matches = reconcileBooksVs2b(books, portal);
    await persistReconResults(business_id, tax_period, runId, rowIds, matches);
    const summary = summarizeRecon(matches);

    return { success: true, run_id: runId, tax_period, summary };
  });

  // POST /api/v1/reconcile/ims/:rowId
  app.post("/ims/:rowId", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId as string;
    const rowId = (request.params as any).rowId as string;
    const body = z.object({
      action: z.enum(["accept", "reject", "pending"]),
      note: z.string().max(500).optional(),
    }).safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "action: accept | reject | pending" },
      });
    }

    const existing = await query(
      `SELECT g.*, b.owner_id
         FROM gstr2b_rows g
         JOIN businesses b ON b.id = g.business_id
        WHERE g.id = $1`,
      [rowId]
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "2B row nahi mili" },
      });
    }

    const row = existing.rows[0];
    if (!(await canAccessBusiness(row.business_id, userId))) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const updated = await query(
      `UPDATE gstr2b_rows
          SET ims_action = $1, ims_note = $2
        WHERE id = $3
        RETURNING *`,
      [body.data.action, body.data.note || null, rowId]
    );

    await logAuditEvent({
      userId,
      businessId: row.business_id,
      action: `ims.${body.data.action}`,
      entityType: "gstr2b_row",
      entityId: rowId,
      details: { invoice_number: row.invoice_number, note: body.data.note },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return {
      success: true,
      row: updated.rows[0],
      message:
        body.data.action === "accept"
          ? "IMS Accept — sirf jab books + 2B dono clean hon"
          : body.data.action === "reject"
            ? "IMS Reject — supplier se correction lo"
            : "IMS pending pe wapas",
    };
  });
}
