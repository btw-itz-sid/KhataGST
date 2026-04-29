// src/routes/export.ts
// GSTR-1 Excel aur CSV export endpoints
// Fix: business ownership verify karo pehle (koi bhi doosre ka data download na kar sake)

import { FastifyInstance } from "fastify";
import { exportGSTR1Excel, exportInvoicesCSV } from "../services/exportService.js";
import { query } from "../lib/db.js";
import { z } from "zod";

// ── Ownership check helper ───────────────────────────────────────────────────
// Returns true agar ye business is user ki hai
async function isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
  const result = await query(
    "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2",
    [businessId, userId]
  );
  return result.rows.length > 0;
}

export async function exportRoutes(app: FastifyInstance) {

  // GET /api/v1/export/excel?business_id=xxx&tax_period=2026-03
  app.get("/excel", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do (format: YYYY-MM)" },
      });
    }

    const { userId } = request.user as any;

    // ✅ Fix: Business ownership verify karo
    const owned = await isBusinessOwner(parsed.data.business_id, userId);
    if (!owned) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka data access karne ki permission nahi hai" },
      });
    }

    try {
      const buffer = await exportGSTR1Excel(
        parsed.data.business_id,
        parsed.data.tax_period
      );

      const filename = `GSTR1_${parsed.data.tax_period}.xlsx`;

      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "EXPORT_FAILED", message: err?.message ?? "Excel export fail ho gaya" },
      });
    }
  });

  // GET /api/v1/export/csv?business_id=xxx&tax_period=2026-03
  app.get("/csv", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do (format: YYYY-MM)" },
      });
    }

    const { userId } = request.user as any;

    // ✅ Fix: Business ownership verify karo
    const owned = await isBusinessOwner(parsed.data.business_id, userId);
    if (!owned) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka data access karne ki permission nahi hai" },
      });
    }

    try {
      const csv = await exportInvoicesCSV(
        parsed.data.business_id,
        parsed.data.tax_period
      );

      const filename = `invoices_${parsed.data.tax_period}.csv`;

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(csv);
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "EXPORT_FAILED", message: err?.message ?? "CSV export fail ho gaya" },
      });
    }
  });
}