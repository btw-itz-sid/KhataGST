import { FastifyInstance } from "fastify";
import { z } from "zod";
import { canAccessBusiness } from "../lib/ownership.js";
import { buildComplianceNudges } from "../services/complianceNudgeService.js";
import { getPlanUsage } from "../services/planLimits.js";
import { suggestHsn } from "../services/hsnSuggestService.js";

export async function complianceRoutes(app: FastifyInstance) {
  // GET /api/v1/compliance/nudges?business_id=&tax_period=
  app.get("/nudges", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = (request.user as any).userId as string;
    const q = z.object({
      business_id: z.string().uuid(),
      tax_period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }).safeParse(request.query);

    if (!q.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id do" },
      });
    }

    if (!(await canAccessBusiness(q.data.business_id, userId))) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const payload = await buildComplianceNudges(q.data.business_id, q.data.tax_period);
    return { success: true, ...payload };
  });

  // GET /api/v1/compliance/usage — plan limits for current user
  app.get("/usage", {
    preHandler: [app.authenticate],
  }, async (request) => {
    const userId = (request.user as any).userId as string;
    const usage = await getPlanUsage(userId);
    return { success: true, usage };
  });

  // GET /api/v1/compliance/hsn-suggest?q=
  app.get("/hsn-suggest", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const q = z.object({
      q: z.string().min(2).max(200),
      limit: z.coerce.number().int().min(1).max(10).optional(),
    }).safeParse(request.query);

    if (!q.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "q (description) do" },
      });
    }

    const suggestions = await suggestHsn(q.data.q, q.data.limit ?? 5);
    return { success: true, suggestions };
  });
}
