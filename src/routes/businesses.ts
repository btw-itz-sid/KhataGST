// src/routes/businesses.ts
import { FastifyInstance } from "fastify";
import * as db from "../lib/db";

function generateUnregisteredGstin(stateCode: string): string {
  const entropy = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padStart(10, "0")
    .slice(-10);

  return `${stateCode}URP${entropy}`;
}

export async function businessRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Login karo pehle" });
    }
  });

  // POST /api/v1/businesses
  fastify.post("/", async (request, reply) => {
    const userId = (request.user as any).userId;
    const {
      gstin,
      legal_name,
      trade_name,
      owner_name,
      address,
      state_code,
      registration_type,
    } = request.body as any;

    const normalizedStateCode = String(state_code ?? "").trim().slice(0, 2);
    const normalizedLegalName = String(legal_name ?? "").trim();
    const normalizedTradeName = String(trade_name ?? legal_name ?? "").trim();
    const normalizedRegistrationType = String(
      registration_type ?? (gstin ? "regular" : "unregistered")
    ).toLowerCase();
    const normalizedGstin = String(gstin ?? "").trim().toUpperCase();

    if (!normalizedLegalName) {
      return reply.status(400).send({ error: "Business ka naam chahiye" });
    }

    if (!normalizedStateCode || normalizedStateCode.length !== 2) {
      return reply.status(400).send({ error: "Valid state code do" });
    }

    if (normalizedRegistrationType !== "unregistered" && normalizedGstin.length !== 15) {
      return reply.status(400).send({ error: "Registered business ke liye valid 15 character GSTIN chahiye" });
    }

    try {
      const gstinToSave =
        normalizedGstin.length === 15
          ? normalizedGstin
          : generateUnregisteredGstin(normalizedStateCode);

      const result = await db.query(
        `INSERT INTO businesses 
           (owner_id, gstin, legal_name, trade_name, address, state_code, business_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          userId,
          gstinToSave,
          normalizedLegalName,
          normalizedTradeName,
          address ?? null,
          normalizedStateCode,
          normalizedRegistrationType,
        ]
      );

      if (owner_name) {
        await db.query(
          `UPDATE users
           SET name = $1, updated_at = NOW()
           WHERE id = $2`,
          [String(owner_name).trim(), userId]
        );
      }

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
