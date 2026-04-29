// src/routes/scans.ts
// Bill scan routes — image upload, AI extraction, retry
// Fix: Images ab permanent uploads/ folder mein save hoti hain (tmp ki jagah)
// Fix: Scan GET list mein business ownership check add kiya gaya

import { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import {
  createManualReviewFallback,
  scanBillWithAI,
} from "../services/billScanService.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ── Uploads directory — permanent storage (Railway volume ya local) ──────────
// /tmp ke badle uploads/ folder use karo — retry ke liye file milti rahegi
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");

// Server start hone par directory create karo
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Uploads directory created: ${UPLOADS_DIR}`);
}

// ── Allowed file types ───────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export async function scanRoutes(app: FastifyInstance) {

  // POST /api/v1/scans — bill image upload karo aur AI se scan karwao
  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const parts = request.parts();

    let business_id = "";
    let filename = "scan.jpg";
    let fileBuffer: Buffer | null = null;
    let detectedMimeType = "";

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "bill") {
        filename = part.filename || filename;
        detectedMimeType = part.mimetype || "";
        fileBuffer = await part.toBuffer();
        continue;
      }

      if (part.type === "field" && part.fieldname === "business_id") {
        business_id = String(part.value ?? "").trim();
      }
    }

    if (!fileBuffer) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_FILE", message: "Image file bhejo (jpg/png/webp/pdf)" },
      });
    }

    if (!business_id) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_BUSINESS", message: "business_id do" },
      });
    }

    // ✅ File type validation
    const ext = path.extname(filename).toLowerCase() || ".jpg";
    if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(detectedMimeType)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Sirf JPG, PNG, WEBP ya PDF upload karo",
        },
      });
    }

    // ✅ Fix: Permanent uploads/ folder mein save karo (not /tmp)
    // Retry ke waqt file milegi kyunki delete nahi hogi
    const safeFilename = `scan_${Date.now()}_${userId.slice(0, 8)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);
    fs.writeFileSync(filePath, fileBuffer);

    // Business ownership verify karo
    const bizCheck = await query(
      "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2",
      [business_id, userId]
    );
    if (bizCheck.rows.length === 0) {
      // File cleanup karo
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const scanRecord = await query(
      `INSERT INTO bill_scans (business_id, uploaded_by, file_url, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [business_id, userId, filePath]
    );
    const scanId = scanRecord.rows[0].id;

    try {
      const result = await scanBillWithAI(filePath);

      await query(
        `UPDATE bill_scans
         SET status = 'done',
             extracted_data = $1,
             confidence = $2,
             error_message = $3,
             completed_at = NOW()
         WHERE id = $4`,
        [
          JSON.stringify(result.extracted_data),
          result.confidence_score,
          result.fallback_reason ?? null,
          scanId,
        ]
      );

      return reply.send({
        success: true,
        scan: {
          id: scanId,
          status: "done",
          confidence_score: result.confidence_score,
          action: result.action,
          extracted_data: result.extracted_data,
          mock_mode: Boolean(result.fallback_mode),
          fallback_mode: result.fallback_mode ?? null,
          fallback_reason: result.fallback_reason ?? null,
        },
      });

    } catch (err: any) {
      console.error("Scan failed — Gemini error:", err?.message ?? err);

      // Always fallback — user manually fill kar sakta hai
      const fallback = createManualReviewFallback(
        err?.message ?? "AI scan failed. Fill invoice details manually."
      );

      try {
        await query(
          `UPDATE bill_scans
           SET status = 'done',
               extracted_data = $1,
               confidence = $2,
               error_message = $3,
               completed_at = NOW()
           WHERE id = $4`,
          [
            JSON.stringify(fallback.extracted_data),
            fallback.confidence_score,
            err?.message ?? "Unknown error",
            scanId,
          ]
        );
      } catch (dbErr: any) {
        console.error("DB update failed after scan error:", dbErr?.message);
      }

      return reply.send({
        success: true,
        scan: {
          id: scanId,
          status: "done",
          confidence_score: 0,
          action: "manual",
          extracted_data: fallback.extracted_data,
          mock_mode: true,
          fallback_mode: "manual_review",
          fallback_reason: "AI scan incomplete. Fill fields manually.",
        },
      });
    }
  });

  // GET /api/v1/scans/:id — ek scan ka detail fetch karo
  app.get("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as { id: string };

    // ✅ Ownership check — sirf apna scan dekho
    const result = await query(
      `SELECT s.* FROM bill_scans s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = $1 AND b.owner_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Scan nahi mila" },
      });
    }
    return reply.send({ success: true, data: result.rows[0] });
  });

  // POST /api/v1/scans/:id/retry — pehle fail hua scan dobara try karo
  app.post("/:id/retry", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { id } = request.params as { id: string };

    try {
      const scanResult = await query(
        `SELECT s.* FROM bill_scans s
         JOIN businesses b ON s.business_id = b.id
         WHERE s.id = $1 AND b.owner_id = $2`,
        [id, userId]
      );

      if (scanResult.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Scan nahi mila ya unauthorized" },
        });
      }

      const scan = scanResult.rows[0];
      const filePath = scan.file_url;

      // ✅ Fix: File permanent uploads/ mein hai, isliye milegi
      if (!filePath || !fs.existsSync(filePath)) {
        return reply.status(410).send({
          success: false,
          error: {
            code: "FILE_MISSING",
            message: "Original image file nahi mila. Naya scan karo.",
          },
        });
      }

      await query(
        `UPDATE bill_scans SET status = 'processing' WHERE id = $1`,
        [id]
      );

      try {
        const result = await scanBillWithAI(filePath);

        await query(
          `UPDATE bill_scans
           SET status = 'done',
               extracted_data = $1,
               confidence = $2,
               error_message = $3,
               completed_at = NOW()
           WHERE id = $4`,
          [
            JSON.stringify(result.extracted_data),
            result.confidence_score,
            result.fallback_reason ?? null,
            id,
          ]
        );

        return reply.send({
          success: true,
          message: "Scan retry ho gaya",
          scan: {
            id,
            status: "done",
            confidence_score: result.confidence_score,
            action: result.action,
            extracted_data: result.extracted_data,
            fallback_reason: result.fallback_reason ?? null,
          },
        });
      } catch (err: any) {
        console.error("Scan retry failed:", err?.message);

        const fallback = createManualReviewFallback(
          err?.message ?? "Retry failed. Fill manually."
        );

        await query(
          `UPDATE bill_scans
           SET status = 'done',
               extracted_data = $1,
               confidence = $2,
               error_message = $3,
               completed_at = NOW()
           WHERE id = $4`,
          [
            JSON.stringify(fallback.extracted_data),
            fallback.confidence_score,
            err?.message ?? "Retry failed",
            id,
          ]
        );

        return reply.send({
          success: true,
          message: "Scan fallback mode mein set ho gaya",
          scan: {
            id,
            status: "done",
            confidence_score: 0,
            action: "manual",
            extracted_data: fallback.extracted_data,
            fallback_reason: "AI retry failed. Please fill manually.",
          },
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err?.message ?? "Kuch galat ho gaya" },
      });
    }
  });

  // GET /api/v1/scans — business ke sabhi scans ki list
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const { business_id } = request.query as any;

    if (!business_id) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "business_id do" },
      });
    }

    // ✅ Fix: Business ownership verify karo pehle
    const bizCheck = await query(
      "SELECT id FROM businesses WHERE id = $1 AND owner_id = $2",
      [business_id, userId]
    );
    if (bizCheck.rows.length === 0) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Is business ka access nahi hai" },
      });
    }

    const result = await query(
      `SELECT id, status, confidence, created_at, completed_at
       FROM bill_scans
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [business_id]
    );
    return reply.send({ success: true, data: result.rows });
  });
}