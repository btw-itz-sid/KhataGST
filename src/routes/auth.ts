// src/routes/auth.ts
// Auth routes — OTP send/verify aur /me endpoint
// OTP ab in-memory Map ki jagah DB mein store hota hai (restart-safe)
// Brute force protection: max 5 galat attempts, phir naya OTP maango

import { FastifyInstance } from "fastify";
import * as path from "path";
import * as fs from "fs";
import { z } from "zod";
import { query } from "../lib/db.js";
import { sendWelcomeEmail } from "../services/emailService.js";

const DEV_OTP_LOG_PATH = path.resolve(
  process.cwd(),
  process.env.DEV_OTP_LOG_PATH || "dev-otp.log"
);

const MAX_OTP_ATTEMPTS = 5; // 5 galat tries ke baad OTP invalidate

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

// ── OTP DB helpers ────────────────────────────────────────────────────────────

async function saveOtpToDB(phone: string, otp: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  // Purane OTP delete karo pehle
  await query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);

  // Naya OTP insert karo
  await query(
    `INSERT INTO otp_verifications (phone, otp_hash, otp, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [phone, otp, otp, expiresAt.toISOString()]
  );
}

async function verifyOtpFromDB(
  phone: string,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  const result = await query(
    `SELECT * FROM otp_verifications
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: "OTP_NOT_FOUND" };
  }

  const record = result.rows[0];

  // Expiry check
  if (new Date() > new Date(record.expires_at)) {
    await query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);
    return { valid: false, reason: "OTP_EXPIRED" };
  }

  // Brute force check — max 5 attempts
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);
    return { valid: false, reason: "TOO_MANY_ATTEMPTS" };
  }

  // Wrong OTP — increment attempt count
  if (record.otp !== otp) {
    await query(
      "UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1",
      [record.id]
    );
    return { valid: false, reason: "WRONG_OTP" };
  }

  // Sahi OTP — delete record (single use)
  await query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);
  return { valid: true };
}

// ── SMS send karo ─────────────────────────────────────────────────────────────

async function sendOTP(phone: string, otp: string): Promise<void> {
  // Development — skip real SMS, just log to file
  if (process.env.NODE_ENV !== "production") {
    const line = `[${new Date().toISOString()}] OTP for ${phone}: ${otp}\n`;
    console.log(line.trim());
    fs.appendFileSync(DEV_OTP_LOG_PATH, line, "utf8");
    return;
  }

  // Production — send via Fast2SMS
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY not set in environment");
  }

  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "otp",
      variables_values: otp,
      numbers: phone,
      flash: 0,
    }),
  });

  const data = (await response.json()) as {
    return: boolean;
    status_code: number;
    message: string[];
    request_id?: string;
  };

  if (!response.ok || !data.return) {
    console.error("Fast2SMS error:", data);
    throw new Error(
      `Fast2SMS OTP send failed: ${data.message?.join(", ") ?? "Unknown error"}`
    );
  }

  console.log(`OTP sent to ${phone} via Fast2SMS — request_id: ${data.request_id}`);
}

// ── Auth Routes ───────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/send-otp
  app.post("/send-otp", async (request, reply) => {
    const schema = z.object({
      phone: z.string().min(10).max(10),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_PHONE", message: "Phone number sahi nahi hai" },
      });
    }

    const { phone } = parsed.data;

    if (!isValidPhone(phone)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "INVALID_PHONE",
          message: "Valid Indian mobile number do (6-9 se shuru hona chahiye)",
        },
      });
    }

    const otp = generateOTP();

    try {
      // OTP DB mein save karo (server restart-safe)
      await saveOtpToDB(phone, otp);
    } catch (dbErr) {
      console.error("OTP DB save failed:", dbErr);
      return reply.status(500).send({
        success: false,
        error: {
          code: "OTP_SAVE_FAILED",
          message: "OTP generate karne mein dikkat, thodi der baad try karo",
        },
      });
    }

    try {
      await sendOTP(phone, otp);
    } catch (err) {
      console.error("OTP send error:", err);
      return reply.status(500).send({
        success: false,
        error: {
          code: "OTP_SEND_FAILED",
          message: "OTP bhejne mein dikkat aayi, thodi der baad try karo",
        },
      });
    }

    return reply.send({
      success: true,
      message: `OTP bheja gaya ${phone} pe`,
      data: {
        message: `OTP bheja gaya ${phone} pe`,
      },
    });
  });

  // POST /api/v1/auth/verify-otp
  app.post("/verify-otp", async (request, reply) => {
    const schema = z.object({
      phone: z.string().min(10).max(10),
      otp: z.string().length(6),
      name: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Phone aur 6-digit OTP do" },
      });
    }

    const { phone, otp, name } = parsed.data;

    // DB se OTP verify karo (brute force protection included)
    const verification = await verifyOtpFromDB(phone, otp);

    if (!verification.valid) {
      const messages: Record<string, string> = {
        OTP_NOT_FOUND: "Pehle OTP maango",
        OTP_EXPIRED: "OTP expire ho gaya, dobara maango",
        WRONG_OTP: "OTP galat hai",
        TOO_MANY_ATTEMPTS: "Bahut zyada galat attempts, naya OTP maango",
      };

      const httpStatus = verification.reason === "TOO_MANY_ATTEMPTS" ? 429 : 400;

      return reply.status(httpStatus).send({
        success: false,
        error: {
          code: verification.reason ?? "OTP_INVALID",
          message: messages[verification.reason ?? ""] ?? "OTP verify nahi ho paya",
        },
      });
    }

    // OTP sahi hai — user create/fetch karo
    let user;
    let isNewUser = false;

    try {
      const existing = await query("SELECT * FROM users WHERE phone = $1", [phone]);

      if (existing.rows.length > 0) {
        user = existing.rows[0];
      } else {
        isNewUser = true;
        const created = await query(
          `INSERT INTO users (phone, name, plan)
           VALUES ($1, $2, 'free')
           RETURNING *`,
          [phone, name ?? "KhataGST User"]
        );
        user = created.rows[0];
        console.log(`Naya user bana: ${phone}`);

        // Welcome email bhejo — non-blocking
        if (user.email) {
          sendWelcomeEmail(user.email, user.name ?? "KhataGST User").catch((e) =>
            console.warn("Welcome email failed:", e?.message)
          );
        }
      }
    } catch (dbErr) {
      console.error("User create/fetch failed:", dbErr);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_ERROR", message: "User data load nahi ho paya" },
      });
    }

    const token = app.jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
        plan: user.plan,
      },
      { expiresIn: "30d" }
    );

    return reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        plan: user.plan,
      },
      is_new_user: isNewUser,
      data: {
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          plan: user.plan,
        },
        is_new_user: isNewUser,
      },
    });
  });

  // GET /api/v1/auth/me
  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { userId } = request.user as any;

      try {
        const result = await query(
          "SELECT id, phone, name, email, plan, created_at FROM users WHERE id = $1",
          [userId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            success: false,
            error: { code: "USER_NOT_FOUND", message: "User nahi mila" },
          });
        }

        return reply.send({
          success: true,
          data: result.rows[0],
        });
      } catch (err) {
        console.error("/me DB error:", err);
        return reply.status(500).send({
          success: false,
          error: { code: "DB_ERROR", message: "User data load nahi ho paya" },
        });
      }
    }
  );
}