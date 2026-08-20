// src/routes/parties.ts
// Customers aur Suppliers manage karne ke liye
// Har invoice mein party hoti hai — ye unka database hai

import { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import { z } from "zod";

export async function partyRoutes(app: FastifyInstance) {

  // POST /api/v1/parties — naya party banao
  app.post("/", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      name: z.string().min(1),
      gstin: z.string().length(15).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      state_code: z.string().length(2).optional(),
      is_supplier: z.boolean().default(false),
      is_customer: z.boolean().default(true),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: parsed.error.errors[0].message },
      });
    }

    const {
      business_id, name, gstin, phone,
      email, address, state_code,
      is_supplier, is_customer
    } = parsed.data;

    // GSTIN validate karo agar diya hai
    if (gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.toUpperCase())) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_GSTIN", message: "GSTIN format galat hai" },
        });
      }
    }

    try {
      const result = await query(
        `INSERT INTO parties 
         (business_id, name, gstin, phone, email, address, state_code, is_supplier, is_customer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [business_id, name, gstin?.toUpperCase() ?? null, phone ?? null,
         email ?? null, address ?? null, state_code ?? null,
         is_supplier, is_customer]
      );

      return reply.status(201).send({
        success: true,
        party: result.rows[0],
      });
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.status(400).send({
          success: false,
          error: { code: "DUPLICATE", message: "Ye GSTIN already register hai" },
        });
      }
      throw err;
    }
  });

  // GET /api/v1/parties?business_id=xxx — saari parties dekho
  app.get("/", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      type: z.enum(["customer", "supplier", "all"]).default("all"),
      search: z.string().optional(),
    });

    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id do" },
      });
    }

    const { business_id, type, search } = parsed.data;

    let whereClause = "WHERE business_id = $1";
    const params: any[] = [business_id];

    // Type filter
    if (type === "customer") {
      whereClause += " AND is_customer = true";
    } else if (type === "supplier") {
      whereClause += " AND is_supplier = true";
    }

    // Search filter
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR gstin ILIKE $${params.length})`;
    }

    const result = await query(
      `SELECT * FROM parties ${whereClause} ORDER BY name ASC`,
      params
    );

    return reply.send({
      success: true,
      data: result.rows,
      meta: { total: result.rowCount },
    });
  });

  // GET /api/v1/parties/:id — ek party dekho
  app.get("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await query(
      "SELECT * FROM parties WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Party nahi mili" },
      });
    }

    return reply.send({
      success: true,
      data: result.rows[0],
    });
  });

  // PUT /api/v1/parties/:id — party update karo
  app.put("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const schema = z.object({
      name: z.string().min(1).optional(),
      gstin: z.string().length(15).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      state_code: z.string().length(2).optional(),
      is_supplier: z.boolean().optional(),
      is_customer: z.boolean().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: parsed.error.errors[0].message },
      });
    }

    const fields = parsed.data;
    const updates: string[] = [];
    const params: any[] = [];

    // Dynamic update query banao
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        params.push(value);
        updates.push(`${key} = $${params.length}`);
      }
    });

    if (updates.length === 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_CHANGES", message: "Kuch update karne ke liye do" },
      });
    }

    params.push(id);
    const result = await query(
      `UPDATE parties SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Party nahi mili" },
      });
    }

    return reply.send({
      success: true,
      data: result.rows[0],
    });
  });

  // DELETE /api/v1/parties/:id — party delete karo
  app.delete("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await query(
      "DELETE FROM parties WHERE id = $1 RETURNING id, name",
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Party nahi mili" },
      });
    }

    return reply.send({
      success: true,
      message: `${result.rows[0].name} delete ho gaya`,
    });
  });
}