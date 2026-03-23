// src/routes/invoices.ts
import { FastifyInstance } from "fastify";
import * as db from "../lib/db";

function calculateTax(taxable_paise: number, gst_rate: number, isInterState: boolean) {
  const tax_paise = Math.round((taxable_paise * gst_rate) / 100);
  if (isInterState) {
    return { cgst_paise: 0, sgst_paise: 0, igst_paise: tax_paise };
  } else {
    const half = Math.round(tax_paise / 2);
    return { cgst_paise: half, sgst_paise: half, igst_paise: 0 };
  }
}

function normalizePaise(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function normalizeQuantity(value: unknown): number {
  const numeric = Number(value ?? 1);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

export async function invoiceRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Login karo pehle" });
    }
  });

  // POST /api/v1/invoices
  fastify.post("/", async (request, reply) => {
    const userId = (request.user as any).userId;
    const {
      business_id,
      party_id,
      party_name,
      party_gstin,
      invoice_number,
      invoice_date,
      due_date,
      invoice_type = "sale",
      place_of_supply,
      items,
      notes,
    } = request.body as any;

    if (!items || items.length === 0) {
      return reply.status(400).send({ error: "Kam se kam ek item chahiye" });
    }

    const bizResult = await db.query(
      "SELECT * FROM businesses WHERE id = $1 AND owner_id = $2",
      [business_id, userId]
    );
    if (bizResult.rows.length === 0) {
      return reply.status(403).send({ error: "Business nahi mila ya unauthorized" });
    }

    const business = bizResult.rows[0];
    const sellerStateCode = String(
      business.state_code ?? business.gstin?.substring(0, 2) ?? ""
    );
    const inferredPlaceOfSupply =
      place_of_supply ??
      (typeof party_gstin === "string" && party_gstin.trim().length >= 2
        ? party_gstin.trim().slice(0, 2)
        : sellerStateCode);
    const isInterState = Boolean(
      inferredPlaceOfSupply &&
      sellerStateCode &&
      sellerStateCode !== String(inferredPlaceOfSupply).trim().slice(0, 2)
    );

    let subtotal_paise = 0, total_cgst = 0, total_sgst = 0, total_igst = 0;

    const processedItems = items.map((item: any) => {
      const quantity = normalizeQuantity(item.quantity);
      const unit_price_paise = normalizePaise(item.unit_price_paise ?? item.unit_price);
      const gst_rate = Number(item.gst_rate ?? 0);
      const taxable = Math.round(quantity * unit_price_paise);
      const tax = calculateTax(taxable, Number.isFinite(gst_rate) ? gst_rate : 0, isInterState);
      subtotal_paise += taxable;
      total_cgst += tax.cgst_paise;
      total_sgst += tax.sgst_paise;
      total_igst += tax.igst_paise;
      return {
        description: String(item.description ?? "Line item").trim(),
        hsn_sac: item.hsn_sac ?? item.hsn_sac_code ?? null,
        quantity,
        unit_price_paise,
        gst_rate: Number.isFinite(gst_rate) ? gst_rate : 0,
        taxable_paise: taxable,
        ...tax,
      };
    });

    const total_paise = subtotal_paise + total_cgst + total_sgst + total_igst;

    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      let resolvedPartyId = party_id ?? null;
      const normalizedPartyName = String(party_name ?? "").trim();
      const normalizedPartyGstin = String(party_gstin ?? "").trim().toUpperCase() || null;

      if (!resolvedPartyId && (normalizedPartyName || normalizedPartyGstin)) {
        const existingParty = normalizedPartyGstin
          ? await client.query(
              `SELECT id FROM parties
               WHERE business_id = $1 AND gstin = $2
               ORDER BY created_at DESC
               LIMIT 1`,
              [business_id, normalizedPartyGstin]
            )
          : await client.query(
              `SELECT id FROM parties
               WHERE business_id = $1 AND LOWER(name) = LOWER($2)
               ORDER BY created_at DESC
               LIMIT 1`,
              [business_id, normalizedPartyName]
            );

        if (existingParty.rows.length > 0) {
          resolvedPartyId = existingParty.rows[0].id;
        } else if (normalizedPartyName) {
          const newParty = await client.query(
            `INSERT INTO parties
               (business_id, name, gstin, state_code, is_supplier, is_customer)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING id`,
            [
              business_id,
              normalizedPartyName,
              normalizedPartyGstin,
              normalizedPartyGstin?.slice(0, 2) ?? null,
              invoice_type === "purchase",
              invoice_type !== "purchase",
            ]
          );
          resolvedPartyId = newParty.rows[0].id;
        }
      }

      const invResult = await client.query(
        `INSERT INTO invoices
           (business_id, party_id, invoice_type, invoice_number, invoice_date, due_date,
            taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount, is_igst, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          business_id, resolvedPartyId, invoice_type, invoice_number,
          invoice_date, due_date ?? null,
          subtotal_paise, total_cgst, total_sgst, total_igst, total_paise,
          isInterState, notes ?? null,
        ]
      );
      const invoice = invResult.rows[0];

      for (const item of processedItems) {
        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, description, hsn_sac, quantity, unit_price, gst_rate,
              taxable_value, cgst_amount, sgst_amount, igst_amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            invoice.id, item.description, item.hsn_sac ?? null,
            item.quantity, item.unit_price_paise, String(item.gst_rate),
            item.taxable_paise, item.cgst_paise, item.sgst_paise, item.igst_paise,
          ]
        );
      }

      await client.query("COMMIT");

      reply.status(201).send({
        success: true,
        invoice: { ...invoice, items: processedItems },
        summary: {
          subtotal: `₹${(subtotal_paise / 100).toFixed(2)}`,
          cgst: `₹${(total_cgst / 100).toFixed(2)}`,
          sgst: `₹${(total_sgst / 100).toFixed(2)}`,
          igst: `₹${(total_igst / 100).toFixed(2)}`,
          total: `₹${(total_paise / 100).toFixed(2)}`,
          tax_type: isInterState ? "IGST" : "CGST+SGST",
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // GET /api/v1/invoices
  fastify.get("/", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { business_id, page = 1, limit = 20 } = request.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    let queryText = `
      SELECT i.*, p.name AS party_name, p.gstin AS party_gstin FROM invoices i
      JOIN businesses b ON i.business_id = b.id
      LEFT JOIN parties p ON i.party_id = p.id
      WHERE b.owner_id = $1
      ORDER BY i.invoice_date DESC
      LIMIT $2 OFFSET $3
    `;
    let params: any[] = [userId, limit, offset];

    if (business_id) {
      queryText = `
        SELECT i.*, p.name AS party_name, p.gstin AS party_gstin FROM invoices i
        JOIN businesses b ON i.business_id = b.id
        LEFT JOIN parties p ON i.party_id = p.id
        WHERE b.owner_id = $1 AND i.business_id = $4
        ORDER BY i.invoice_date DESC
        LIMIT $2 OFFSET $3
      `;
      params = [userId, limit, offset, business_id];
    }

    const result = await db.query(queryText, params);
    reply.send({ success: true, invoices: result.rows, page: +page, limit: +limit });
  });

  // GET /api/v1/invoices/:id
  fastify.get("/:id", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as any;

    const invResult = await db.query(
      `SELECT i.*, p.name AS party_name, p.gstin AS party_gstin FROM invoices i
       JOIN businesses b ON i.business_id = b.id
       LEFT JOIN parties p ON i.party_id = p.id
       WHERE i.id = $1 AND b.owner_id = $2`,
      [id, userId]
    );
    if (invResult.rows.length === 0) {
      return reply.status(404).send({ error: "Invoice nahi mila" });
    }

    const itemsResult = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id",
      [id]
    );
    reply.send({ success: true, invoice: invResult.rows[0], items: itemsResult.rows });
  });

  // PUT /api/v1/invoices/:id
  fastify.put("/:id", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as any;
    const { notes, due_date } = request.body as any;

    const result = await db.query(
      `UPDATE invoices
       SET notes = COALESCE($1, notes),
           due_date = COALESCE($2, due_date),
           updated_at = NOW()
       WHERE id = $3
         AND is_cancelled = FALSE
         AND business_id IN (SELECT id FROM businesses WHERE owner_id = $4)
       RETURNING *`,
      [notes, due_date, id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Invoice nahi mila ya unauthorized" });
    }
    reply.send({ success: true, invoice: result.rows[0] });
  });

  // DELETE /api/v1/invoices/:id
  fastify.delete("/:id", async (request, reply) => {
    const userId = (request.user as any).userId;
    const { id } = request.params as any;

    const result = await db.query(
      `UPDATE invoices SET is_cancelled = TRUE, updated_at = NOW()
       WHERE id = $1
         AND is_cancelled = FALSE
         AND business_id IN (SELECT id FROM businesses WHERE owner_id = $2)
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: "Invoice nahi mila ya already cancelled" });
    }
    reply.send({ success: true, message: "Invoice cancel ho gaya", id });
  });
}
