// src/routes/returns.ts
import { FastifyInstance } from "fastify";
import { computeGSTR1, formatPaise } from "../services/gstr1Service.js";
import { z } from "zod";
import { query as dbQuery } from "../lib/db.js";
import { sendGSTReturnFiledEmail } from "../services/emailService.js";

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

  // POST /api/v1/returns/gstr1/:id/recompute
  // Agar invoices updated ho gayi ho toh return recompute karo
  app.post("/gstr1/:id/recompute", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as any;

    try {
      const { query: dbQuery } = await import("../lib/db.js");

      // Return record fetch karo aur verify karo ki user ke paas access hai
      const returnResult = await dbQuery(
        `SELECT r.* FROM gst_returns r
         JOIN businesses b ON r.business_id = b.id
         WHERE r.id = $1 AND r.return_type = 'GSTR-1' AND b.owner_id = $2`,
        [id, userId]
      );

      if (returnResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Return nahi mila ya unauthorized" },
        });
      }

      const returnRecord = returnResult.rows[0];

      // Recompute GSTR-1
      const recomputedGSTR1 = await computeGSTR1(
        returnRecord.business_id,
        returnRecord.tax_period
      );

      // Update return record with new computation
      await dbQuery(
        `UPDATE gst_returns
         SET status = 'computed',
             summary_json = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(recomputedGSTR1), id]
      );

      return reply.send({
        success: true,
        message: "GSTR-1 recomputed successfully",
        gstr1: {
          ...recomputedGSTR1,
          summary_readable: {
            period: returnRecord.tax_period,
            due_date: recomputedGSTR1.due_date,
            status: "computed",
            total_invoices: recomputedGSTR1.totals.total_invoices,
            taxable_value: formatPaise(recomputedGSTR1.totals.taxable_value),
            cgst: formatPaise(recomputedGSTR1.totals.cgst),
            sgst: formatPaise(recomputedGSTR1.totals.sgst),
            igst: formatPaise(recomputedGSTR1.totals.igst),
            total_tax: formatPaise(recomputedGSTR1.totals.total_tax),
            grand_total: formatPaise(recomputedGSTR1.totals.grand_total),
          },
        },
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err?.message ?? "Recompute fail ho gaya" },
      });
    }
  });

  // POST /api/v1/returns/gstr3b/:id/recompute
  app.post("/gstr3b/:id/recompute", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as any;

    try {
      const { query: dbQuery } = await import("../lib/db.js");
      const { computeGSTR3B } = await import("../services/gstr3bService.js");

      // Return record fetch karo
      const returnResult = await dbQuery(
        `SELECT r.* FROM gst_returns r
         JOIN businesses b ON r.business_id = b.id
         WHERE r.id = $1 AND r.return_type = 'GSTR-3B' AND b.owner_id = $2`,
        [id, userId]
      );

      if (returnResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Return nahi mila ya unauthorized" },
        });
      }

      const returnRecord = returnResult.rows[0];

      // Recompute GSTR-3B
      const recomputedGSTR3B = await computeGSTR3B(
        returnRecord.business_id,
        returnRecord.tax_period
      );

      // Update return record
      await dbQuery(
        `UPDATE gst_returns
         SET status = 'computed',
             summary_json = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(recomputedGSTR3B), id]
      );

      return reply.send({
        success: true,
        message: "GSTR-3B recomputed successfully",
        gstr3b: recomputedGSTR3B,
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err?.message ?? "Recompute fail ho gaya" },
      });
    }
  });

  // POST /api/v1/returns/:id/file
  // GST return file karo (mark as filed, generate ARN and send email notification)
  app.post("/:id/file", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as any;

    try {
      // Return record aur business/owner verify karo
      const returnResult = await dbQuery(
        `SELECT r.*, b.legal_name FROM gst_returns r
         JOIN businesses b ON r.business_id = b.id
         WHERE r.id = $1 AND b.owner_id = $2`,
        [id, userId]
      );

      if (returnResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Return nahi mila ya unauthorized" },
        });
      }

      const returnRecord = returnResult.rows[0];

      if (returnRecord.status === "filed") {
        return reply.status(400).send({
          success: false,
          error: { code: "ALREADY_FILED", message: "Yeh return already file ho chuka hai" },
        });
      }

      // Generate unique random ARN (format: AA + 13 digits)
      const arn = `AA${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

      // Update DB to filed
      await dbQuery(
        `UPDATE gst_returns
         SET status = 'filed',
             arn = $1,
             filed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [arn, id]
      );

      // Fetch user's email for notification
      const userResult = await dbQuery(
        "SELECT email FROM users WHERE id = $1",
        [userId]
      );
      const email = userResult.rows[0]?.email;

      if (email) {
        // Send email non-blocking
        sendGSTReturnFiledEmail(
          email,
          returnRecord.legal_name,
          returnRecord.return_type,
          returnRecord.tax_period,
          arn
        ).catch((e) => console.warn("Filing email send failed:", e?.message));
      }

      return reply.send({
        success: true,
        message: "GST Return filed successfully",
        arn,
        filed_at: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err?.message ?? "Filing process failed" },
      });
    }
  });
}
