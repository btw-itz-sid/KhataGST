import { FastifyInstance } from "fastify";
import * as path from "path";
import * as fs from "fs";
import { z } from "zod";
import { query } from "../lib/db.js";

const otpStore = new Map<string, { otp: string; expires: number }>();

const DEV_OTP_LOG_PATH = path.resolve(
  process.cwd(),
  process.env.DEV_OTP_LOG_PATH || "dev-otp.log"
);

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

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

export async function authRoutes(app: FastifyInstance) {
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
          message: "Valid Indian mobile number do",
        },
      });
    }

    const otp = generateOTP();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(phone, { otp, expires });

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

    otpStore.delete(phone);

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
      }
    } catch {
      console.warn("DB not connected, using mock user");
      isNewUser = true;
      user = {
        id: "00000000-0000-4000-8000-000000000000",
        phone,
        name: name ?? "Test User",
        plan: "free",
      };
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
      } catch {
        return reply.send({
          success: true,
          data: { userId, message: "DB connected nahi, mock data" },
        });
      }
    }
  );
}