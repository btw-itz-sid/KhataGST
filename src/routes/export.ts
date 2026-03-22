// src/routes/export.ts
import { FastifyInstance } from "fastify";
import { exportGSTR1Excel, exportInvoicesCSV } from "../services/exportService.js";
import { z } from "zod";

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
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do" },
      });
    }

    const buffer = await exportGSTR1Excel(
      parsed.data.business_id,
      parsed.data.tax_period
    );

    const filename = `GSTR1_${parsed.data.tax_period}.xlsx`;

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(buffer);
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
        error: { code: "INVALID_INPUT", message: "business_id aur tax_period do" },
      });
    }

    const csv = await exportInvoicesCSV(
      parsed.data.business_id,
      parsed.data.tax_period
    );

    const filename = `invoices_${parsed.data.tax_period}.csv`;

    reply
      .header("Content-Type", "text/csv")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });
}