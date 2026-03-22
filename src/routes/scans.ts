// src/routes/scans.ts
// Bill Scan API — abhi mock mode mein hai
// Jab real Anthropic API key aaye toh sirf USE_MOCK = false karna hai!

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../lib/db.js";
import { getScanAction } from "../services/billScanService.js";

// ── MOCK MODE — false karo jab real API key ho ───────────────
const USE_MOCK = true;

// ── Mock response — ek real GST bill jaisa data ──────────────
function getMockScanResult() {
  const confidence = Math.floor(Math.random() * 30) + 70; // 70-99

  return {
    invoice_number: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
    invoice_date: new Date().toISOString().split("T")[0],
    seller_gstin: "27AABCU9603R1ZX",
    seller_name: "Mock Supplier Pvt Ltd",
    buyer_gstin: null,
    is_igst: false,
    items: [
      {
        description: "Office Stationery",
        hsn_sac: "4820",
        quantity: 10,
        unit: "NOS",
        unit_price_paise: 50000,   // Rs. 500 each
        gst_rate: "12",
        taxable_value_paise: 500000, // Rs. 5000
      },
      {
        description: "Printer Paper A4",
        hsn_sac: "4802",
        quantity: 5,
        unit: "PKT",
        unit_price_paise: 80000,   // Rs. 800 each
        gst_rate: "12",
        taxable_value_paise: 400000, // Rs. 4000
      }
    ],
    taxable_value_paise: 900000,  // Rs. 9000
    cgst_paise: 54000,            // Rs. 540 (6%)
    sgst_paise: 54000,            // Rs. 540 (6%)
    igst_paise: 0,
    total_paise: 1008000,         // Rs. 10,080
    confidence,
  };
}

// ── Routes ────────────────────────────────────────────────────
export async function scanRoutes(app: FastifyInstance) {

  // POST /api/v1/scans — bill scan karo
  app.post("/", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      business_id: z.string().uuid(),
      // Production mein file upload hogi
      // Abhi mock ke liye sirf business_id chahiye
      file_url: z.string().optional().default("mock://bill-image.jpg"),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id do" },
      });
    }

    const { business_id, file_url } = parsed.data;
    const { userId } = request.user as any;

    // Scan job DB mein banao
    const scanRecord = await query(
      `INSERT INTO bill_scans 
       (business_id, uploaded_by, file_url, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [business_id, userId, file_url]
    );

    const scanId = scanRecord.rows[0].id;

    // Mock ya real scan
    let extractedData;
    if (USE_MOCK) {
      // Thoda delay simulate karo — real scan jaisa feel
      await new Promise(resolve => setTimeout(resolve, 1500));
      extractedData = getMockScanResult();
    } else {
      // Real Claude Vision API call
      const { scanBill } = await import("../services/billScanService.js");
      const result = await scanBill(file_url);
      if (!result.success) {
        await query(
          `UPDATE bill_scans SET status = 'failed', error_message = $1 WHERE id = $2`,
          [result.error, scanId]
        );
        return reply.status(500).send({
          success: false,
          error: { code: "SCAN_FAILED", message: result.error },
        });
      }
      extractedData = result.data;
    }

    // DB update karo
    await query(
      `UPDATE bill_scans 
       SET status = 'done', 
           extracted_data = $1, 
           confidence = $2,
           completed_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(extractedData), extractedData.confidence, scanId]
    );

    // Confidence ke hisaab se action decide karo
    const action = getScanAction(extractedData.confidence);

    // Amounts readable format mein
    const readable = {
      taxable_value: `Rs. ${(extractedData.taxable_value_paise / 100).toFixed(2)}`,
      cgst: `Rs. ${(extractedData.cgst_paise / 100).toFixed(2)}`,
      sgst: `Rs. ${(extractedData.sgst_paise / 100).toFixed(2)}`,
      igst: `Rs. ${(extractedData.igst_paise / 100).toFixed(2)}`,
      total: `Rs. ${(extractedData.total_paise / 100).toFixed(2)}`,
    };

    return reply.send({
      success: true,
      scan: {
        id: scanId,
        status: "done",
        confidence: extractedData.confidence,
        action: action.action,       // "auto" | "review" | "manual"
        message: action.message,
        extracted: extractedData,
        readable,
        mock_mode: USE_MOCK,
      }
    });
  });

  // GET /api/v1/scans/:id — scan result dekho
  app.get("/:id", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await query(
      `SELECT * FROM bill_scans WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Scan nahi mila" },
      });
    }

    return reply.send({
      success: true,
      data: result.rows[0],
    });
  });

  // GET /api/v1/scans?business_id=xxx — saare scans dekho
  app.get("/", {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
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

    const result = await query(
      `SELECT id, file_url, status, confidence, created_at, completed_at
       FROM bill_scans 
       WHERE business_id = $1 
       ORDER BY created_at DESC`,
      [parsed.data.business_id]
    );

    return reply.send({
      success: true,
      data: result.rows,
      meta: { total: result.rowCount },
    });
  });
}