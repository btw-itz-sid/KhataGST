// src/routes/returns.ts
import { FastifyInstance } from "fastify";
import { computeGSTR1, formatPaise } from "../services/gstr1Service.js";
import { z } from "zod";

export async function returnRoutes(app: FastifyInstance) {

  // POST /api/v1/returns/gstr1/compute
  app.post("/gstr1/compute", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: parsed.error.errors[0].message },
      });
    }

    const { business_id, tax_period } = parsed.data;
    const gstr1 = await computeGSTR1(business_id, tax_period);

    return reply.send({
      success: true,
      gstr1: {
        ...gstr1,
        summary_readable: {
          period: tax_period,
          due_date: gstr1.due_date,
          status: gstr1.status,
          total_invoices: gstr1.totals.total_invoices,
          taxable_value: formatPaise(gstr1.totals.taxable_value),
          cgst: formatPaise(gstr1.totals.cgst),
          sgst: formatPaise(gstr1.totals.sgst),
          igst: formatPaise(gstr1.totals.igst),
          total_tax: formatPaise(gstr1.totals.total_tax),
          grand_total: formatPaise(gstr1.totals.grand_total),
        }
      },
    });
  });

  // POST /api/v1/returns/gstr3b/compute
  app.post("/gstr3b/compute", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: parsed.error.errors[0].message },
      });
    }

    const { computeGSTR3B } = await import("../services/gstr3bService.js");
    const gstr3b = await computeGSTR3B(
      parsed.data.business_id,
      parsed.data.tax_period
    );

    return reply.send({ success: true, gstr3b });
  });

  // GET /api/v1/returns?business_id=xxx
  app.get("/", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any;
    const schema = z.object({
      business_id: z.string().uuid(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id do" },
      });
    }

    const { query: dbQuery } = await import("../lib/db.js");
    const result = await dbQuery(
      `SELECT r.id, r.return_type, r.tax_period, r.status, r.due_date, r.filed_at, r.arn
       FROM gst_returns r
       JOIN businesses b ON r.business_id = b.id
       WHERE r.business_id = $1
         AND b.owner_id = $2
       ORDER BY tax_period DESC`,
      [parsed.data.business_id, userId]
    );

    return reply.send({
      success: true,
      returns: result.rows,
      data: result.rows,
    });
  });
}
