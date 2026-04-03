// src/routes/gstRates.ts
// GST Rate Master — 0%, 5%, 12%, 18%, 28% maintain karo

import { FastifyInstance } from "fastify";
import * as db from "../lib/db";

export async function gstRatesRoutes(fastify: FastifyInstance) {
  // Sab routes ke liye JWT verify zaroori hai (admin check nahi, sirf logged in)
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Login karo pehle" },
      });
    }
  });

  // GET /api/v1/gst-rates — Sabhi active GST rates list karo
  // Query params: hsn_sac (filter), gst_rate (filter)
  fastify.get("/", async (request, reply) => {
    const { hsn_sac, gst_rate, limit = 50, offset = 0 } = request.query as any;
    const pageLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);
    const pageOffset = Math.max(0, parseInt(offset) || 0);

    try {
      let query = "SELECT * FROM gst_rates WHERE is_active = true";
      const params: any[] = [];

      // HSN/SAC se filter karo agar diya ho
      if (hsn_sac && hsn_sac.trim()) {
        params.push(`%${hsn_sac}%`);
        query += ` AND hsn_sac ILIKE $${params.length}`;
      }

      // GST rate se filter karo agar diya ho
      if (gst_rate !== undefined) {
        params.push(parseFloat(gst_rate));
        query += ` AND gst_rate = $${params.length}`;
      }

      query += " ORDER BY gst_rate ASC, hsn_sac ASC";

      params.push(pageLimit);
      params.push(pageOffset);
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const result = await db.query(query, params);

      // Total count bhi nikalo
      let countQuery = "SELECT COUNT(*) as count FROM gst_rates WHERE is_active = true";
      const countParams: any[] = [];
      let paramIndex = 1;

      if (hsn_sac && hsn_sac.trim()) {
        countParams.push(`%${hsn_sac}%`);
        countQuery += ` AND hsn_sac ILIKE $${paramIndex}`;
        paramIndex++;
      }

      if (gst_rate !== undefined) {
        countParams.push(parseFloat(gst_rate));
        countQuery += ` AND gst_rate = $${paramIndex}`;
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count, 10);

      reply.send({
        success: true,
        data: {
          rates: result.rows,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
          },
        },
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // GET /api/v1/gst-rates/:hsn_sac — Ek specific HSN/SAC ka rate nikalo
  fastify.get("/:hsn_sac", async (request, reply) => {
    const { hsn_sac } = request.params as any;

    try {
      const result = await db.query(
        `SELECT * FROM gst_rates 
         WHERE hsn_sac = $1 AND is_active = true
         ORDER BY effective_from DESC
         LIMIT 1`,
        [hsn_sac.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "HSN/SAC nahi milah" },
        });
      }

      reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // POST /api/v1/gst-rates — Naya GST rate add karo (admin only)
  fastify.post("/", async (request, reply) => {
    const { hsn_sac, description, gst_rate, effective_from, notes } = request.body as any;

    // Input validation
    if (!hsn_sac || !gst_rate === undefined) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_FIELDS", message: "HSN/SAC aur GST rate zaroori hai" },
      });
    }

    const rateValue = parseFloat(gst_rate);
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_RATE", message: "GST rate 0-100 ke beech hona chahiye" },
      });
    }

    try {
      // Check karo agar pehle se is HSN/SAC par rate hai
      const existing = await db.query(
        `SELECT * FROM gst_rates 
         WHERE hsn_sac = $1 AND is_active = true`,
        [hsn_sac.toUpperCase()]
      );

      if (existing.rows.length > 0) {
        // Pehle wala rate ko deactivate karo
        await db.query(
          `UPDATE gst_rates SET is_active = false, effective_to = NOW()
           WHERE hsn_sac = $1 AND is_active = true`,
          [hsn_sac.toUpperCase()]
        );
      }

      // Naya rate add karo
      const result = await db.query(
        `INSERT INTO gst_rates (hsn_sac, description, gst_rate, effective_from, notes, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [
          hsn_sac.toUpperCase(),
          description?.trim() || null,
          rateValue,
          effective_from || new Date().toISOString().split("T")[0],
          notes?.trim() || null,
        ]
      );

      reply.status(201).send({
        success: true,
        data: result.rows[0],
        message: "GST rate add ho gaya",
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // PUT /api/v1/gst-rates/:id — Existing rate ko update karo
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as any;
    const { description, gst_rate, notes } = request.body as any;

    try {
      const result = await db.query(
        `UPDATE gst_rates
         SET description = COALESCE($1, description),
             gst_rate = COALESCE($2, gst_rate),
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          description?.trim() || null,
          gst_rate !== undefined ? parseFloat(gst_rate) : null,
          notes?.trim() || null,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "GST rate nahi mila" },
        });
      }

      reply.send({
        success: true,
        data: result.rows[0],
        message: "GST rate update ho gaya",
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // DELETE /api/v1/gst-rates/:id — Rate ko deactivate karo (actually delete nahi, sirf inactive)
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as any;

    try {
      const result = await db.query(
        `UPDATE gst_rates
         SET is_active = false, effective_to = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "GST rate nahi mila" },
        });
      }

      reply.send({
        success: true,
        data: result.rows[0],
        message: "GST rate deactivate ho gaya",
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // POST /api/v1/gst-rates/search — HSN/SAC ke basis par rate search karo
  fastify.post("/search", async (request, reply) => {
    const { hsn_sac_code } = request.body as any;

    if (!hsn_sac_code) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_CODE", message: "HSN/SAC code zaroori hai" },
      });
    }

    try {
      const result = await db.query(
        `SELECT gst_rate, description FROM gst_rates
         WHERE hsn_sac = $1 AND is_active = true
         LIMIT 1`,
        [hsn_sac_code.toUpperCase()]
      );

      if (result.rows.length === 0) {
        // Agar nahi mila toh common rates suggest karo
        return reply.send({
          success: false,
          error: { code: "NOT_FOUND", message: "HSN/SAC ke liye rate nahi mila" },
          suggestion: "Please add this HSN/SAC code to GST Rate Master",
        });
      }

      reply.send({
        success: true,
        data: result.rows[0],
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });
}
