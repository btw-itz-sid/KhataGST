import { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import {
  createManualReviewFallback,
  scanBillWithAI,
  shouldUseManualReviewFallback,
} from "../services/billScanService.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export async function scanRoutes(app: FastifyInstance) {

  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;
    const parts = request.parts();

    let business_id = "";
    let filename = "scan.jpg";
    let fileBuffer: Buffer | null = null;

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "bill") {
        filename = part.filename || filename;
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
        error: { code: "NO_FILE", message: "Image file bhejo" },
      });
    }

    if (!business_id) {
      return reply.status(400).send({
        success: false,
        error: { code: "NO_BUSINESS", message: "business_id do" },
      });
    }

    const ext = path.extname(filename) || ".jpg";
    const tempPath = path.join(os.tmpdir(), `scan_${Date.now()}${ext}`);
    fs.writeFileSync(tempPath, fileBuffer);
    const scanRecord = await query(
      `INSERT INTO bill_scans (business_id, uploaded_by, file_url, status) VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [business_id, userId, tempPath]
    );
    const scanId = scanRecord.rows[0].id;
    try {
      const result = await scanBillWithAI(tempPath);
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
      fs.unlinkSync(tempPath);
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
        }
      });
    } catch (err: any) {
      if (shouldUseManualReviewFallback(err)) {
        const fallback = createManualReviewFallback(
          "AI scan is unavailable right now. Complete the invoice details manually."
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
            err.message,
            scanId,
          ]
        );
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return reply.send({
          success: true,
          scan: {
            id: scanId,
            status: "done",
            confidence_score: fallback.confidence_score,
            action: fallback.action,
            extracted_data: fallback.extracted_data,
            mock_mode: true,
            fallback_mode: fallback.fallback_mode,
            fallback_reason: fallback.fallback_reason,
          },
        });
      }

      await query(`UPDATE bill_scans SET status = 'failed', error_message = $1 WHERE id = $2`, [err.message, scanId]);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return reply.status(500).send({ success: false, error: { code: "SCAN_FAILED", message: err.message } });
    }
  });

  app.get("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await query(`SELECT * FROM bill_scans WHERE id = $1`, [id]);
    if (result.rows.length === 0) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Scan nahi mila" } });
    return reply.send({ success: true, data: result.rows[0] });
  });

  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { business_id } = request.query as any;
    if (!business_id) return reply.status(400).send({ success: false, error: { code: "INVALID_INPUT", message: "business_id do" } });
    const result = await query(`SELECT id, file_url, status, confidence, created_at FROM bill_scans WHERE business_id = $1 ORDER BY created_at DESC`, [business_id]);
    return reply.send({ success: true, data: result.rows });
  });
}
