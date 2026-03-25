import { FastifyInstance } from "fastify";
import * as fs from "fs";
import * as path from "path";
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

function shouldExposeDevOtp(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.EXPOSE_DEV_OTP === "true"
  );
}

function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

function logDevOtp(phone: string, otp: string): void {
  if (process.env.NODE_ENV === "production") return;

  const line = `[${new Date().toISOString()}] OTP for ${phone}: ${otp}\n`;
  console.log(line.trim());
  fs.appendFileSync(DEV_OTP_LOG_PATH, line, "utf8");
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
    logDevOtp(phone, otp);

    const devOtp = shouldExposeDevOtp() ? otp : undefined;

    return reply.send({
      success: true,
      message: `OTP bheja gaya ${phone} pe`,
      dev_otp: devOtp,
      data: {
        message: `OTP bheja gaya ${phone} pe`,
        dev_otp: devOtp,
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
