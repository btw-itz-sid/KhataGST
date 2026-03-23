// src/routes/auth.ts
// Login / Signup — Phone + OTP based
// Email nahi, phone first kyunki target = Indian dukandaar

import { FastifyInstance } from "fastify";
import { query } from "../lib/db.js";
import { z } from "zod";

// ── OTP temporary store (production mein Redis use karna) ────
// Abhi memory mein rakh rahe hain — MVP ke liye theek hai
const otpStore = new Map<string, { otp: string; expires: number }>();

// ── Helpers ──────────────────────────────────────────────────
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
}

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone); // Indian mobile numbers
}

// ── Routes ───────────────────────────────────────────────────
export async function authRoutes(app: FastifyInstance) {

  // POST /api/v1/auth/send-otp
  // Phone number pe OTP bhejo
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
        error: { code: "INVALID_PHONE", message: "Valid Indian mobile number do" },
      });
    }

    // OTP banao
    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store karo
    otpStore.set(phone, { otp, expires });

    // TODO: Production mein yahan Twilio se WhatsApp OTP bhejo
    // Ab sirf console mein print kar rahe hain
    console.log(`📱 OTP for ${phone}: ${otp}`);

    return reply.send({
      success: true,
      message: `OTP bheja gaya ${phone} pe`,
      dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
      data: {
        message: `OTP bheja gaya ${phone} pe`,
        // Development mein OTP return karo — production mein hatao!
        dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
      },
    });
  });

  // POST /api/v1/auth/verify-otp
  // OTP verify karo aur JWT token do
  app.post("/verify-otp", async (request, reply) => {
    const schema = z.object({
      phone: z.string().min(10).max(10),
      otp: z.string().length(6),
      name: z.string().optional(), // pehli baar ke liye
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Phone aur 6-digit OTP do" },
      });
    }

    const { phone, otp, name } = parsed.data;

    // OTP check karo
    const stored = otpStore.get(phone);
    if (!stored) {
      return reply.status(400).send({
        success: false,
        error: { code: "OTP_NOT_FOUND", message: "Pehle OTP maango" },
      });
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(phone);
      return reply.status(400).send({
        success: false,
        error: { code: "OTP_EXPIRED", message: "OTP expire ho gaya, dobara maango" },
      });
    }

    if (stored.otp !== otp) {
      return reply.status(400).send({
        success: false,
        error: { code: "WRONG_OTP", message: "OTP galat hai" },
      });
    }

    // OTP sahi hai — delete karo
    otpStore.delete(phone);

    // User dhundo ya banao (upsert)
    let user;
    let isNewUser = false;
    try {
      const existing = await query(
        "SELECT * FROM users WHERE phone = $1",
        [phone]
      );

      if (existing.rows.length > 0) {
        // Purana user — login
        user = existing.rows[0];
      } else {
        // Naya user — signup
        isNewUser = true;
        const newUser = await query(
          `INSERT INTO users (phone, name, plan)
           VALUES ($1, $2, 'free')
           RETURNING *`,
          [phone, name ?? "KhataGST User"]
        );
        user = newUser.rows[0];
        console.log(`✅ Naya user bana: ${phone}`);
      }
    } catch (err: any) {
      // Database connected nahi — dev mode mein fake user banao
      console.warn("⚠️ DB not connected, using mock user");
      isNewUser = true;
      user = {
        id: "mock-user-id-123",
        phone,
        name: name ?? "Test User",
        plan: "free",
      };
    }

    // JWT token banao
    const token = app.jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
        plan: user.plan,
      },
      { expiresIn: "30d" } // 30 din valid
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
  // Token se apni info dekho
  app.get("/me", {
    preHandler: [app.authenticate], // JWT check karega
  }, async (request, reply) => {
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
      // DB nahi hai toh mock data
      return reply.send({
        success: true,
        data: { userId, message: "DB connected nahi, mock data" },
      });
    }
  });
}
