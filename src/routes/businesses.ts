// src/routes/businesses.ts
import { FastifyInstance } from "fastify";
import * as db from "../lib/db";

export async function businessRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Login karo pehle" });
    }
  });

  // POST /api/v1/businesses
  fastify.post("/", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { gstin, legal_name, trade_name, address, state_code } = request.body as any;

    if (!gstin || gstin.length !== 15) {
      return reply.status(400).send({ error: "Invalid GSTIN — 15 characters chahiye" });
    }

    try {
      const result = await db.query(
        `INSERT INTO businesses 
           (owner_id, gstin, legal_name, trade_name, address, state_code)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [userId, gstin.toUpperCase(), legal_name, trade_name, address, state_code]
      );
      reply.status(201).send({ success: true, business: result.rows[0] });
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.status(409).send({ error: "Ye GSTIN already registered hai" });
      }
      throw err;
    }
  });

  // GET /api/v1/businesses
  fastify.get("/", async (request, reply) => {
    const userId = (request.user as any).userId;
    const result = await db.query(
      "SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    reply.send({ success: true, businesses: result.rows });
  });

  // GET /api/v1/businesses/:id
  fastify.get("/:id", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as any;
    const result = await db.query(
      "SELECT * FROM businesses WHERE id = $1 AND owner_id = $2",
      [id, userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Business nahi mila" });
    }
    reply.send({ success: true, business: result.rows[0] });
  });
}