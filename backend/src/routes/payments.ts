// src/routes/payments.ts
// Payments router — Razorpay integration for plans basic/ca_pro & verified Webhooks

import { FastifyInstance } from "fastify";
import Razorpay from "razorpay";
import crypto from "crypto";
import { query } from "../lib/db.js";
import { z } from "zod";
import { sendPaymentSuccessEmail } from "../services/emailService.js";
import { logAuditEvent } from "../middleware/rbac.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_SECRET || "",
});

const PLAN_PRICES: Record<string, number> = {
  basic: 14900,   // ₹149 in paise
  ca_pro: 49900,  // ₹499 in paise
};

export async function paymentRoutes(app: FastifyInstance) {
  // POST /api/v1/payments/order — Create a new payment order
  app.post("/order", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;

    const schema = z.object({
      plan: z.enum(["basic", "ca_pro"]),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "basic ya ca_pro plan select karo" },
      });
    }

    const { plan } = parsed.data;
    const amount = PLAN_PRICES[plan];

    try {
      const options = {
        amount, // in paise
        currency: "INR",
        receipt: `receipt_user_${userId.slice(0, 8)}_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      // Insert pending payment into database
      await query(
        `INSERT INTO payments (user_id, razorpay_order, amount_paise, plan, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [userId, order.id, amount, plan]
      );

      return reply.send({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error("Razorpay order creation failed:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "ORDER_FAILED", message: err.message || "Order create nahi ho paya" },
      });
    }
  });

  // POST /api/v1/payments/verify — Verify payment signature and update plan
  app.post("/verify", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { userId } = request.user as any;

    const schema = z.object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
      plan: z.enum(["basic", "ca_pro"]),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_INPUT", message: "Payment details miss ho gaye" },
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = parsed.data;

    // Verify signature
    const secret = process.env.RAZORPAY_SECRET || "";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Update payment record to failed
      await query(
        `UPDATE payments
         SET status = 'failed', razorpay_payment = $1
         WHERE razorpay_order = $2 AND user_id = $3`,
        [razorpay_payment_id, razorpay_order_id, userId]
      );

      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_SIGNATURE", message: "Payment verification signature match nahi hua" },
      });
    }

    try {
      // Update payment record to success/captured
      await query(
        `UPDATE payments
         SET status = 'captured', razorpay_payment = $1
         WHERE razorpay_order = $2 AND user_id = $3`,
        [razorpay_payment_id, razorpay_order_id, userId]
      );

      // Update user plan & plan_expires_at (30 days from now)
      await query(
        `UPDATE users
         SET plan = $1,
             plan_expires_at = NOW() + INTERVAL '30 days',
             updated_at = NOW()
         WHERE id = $2`,
         [plan, userId]
      );

      await logAuditEvent({
        userId,
        action: "PAYMENT_CAPTURED",
        entityType: "payment",
        details: { plan, razorpay_order_id, razorpay_payment_id },
      });

      // Fetch user details for sending payment success email
      const userResult = await query(
        "SELECT name, email FROM users WHERE id = $1",
        [userId]
      );
      const user = userResult.rows[0];
      const amount = PLAN_PRICES[plan];

      if (user && user.email) {
        sendPaymentSuccessEmail(
          user.email,
          user.name || "KhataGST User",
          plan,
          amount,
          razorpay_payment_id
        ).catch((e) => console.warn("Payment success email failed:", e?.message));
      }

      return reply.send({
        success: true,
        message: "Payment verified successfully and plan activated",
      });
    } catch (err: any) {
      console.error("DB update after payment verification failed:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_UPDATE_FAILED", message: "Payment verified but database update fail ho gaya" },
      });
    }
  });

  // POST /api/v1/payments/webhook — Razorpay Webhook with Signature Verification
  app.post("/webhook", async (request, reply) => {
    const signature = request.headers["x-razorpay-signature"] as string | undefined;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_SECRET || "";

    if (!signature || !webhookSecret) {
      return reply.status(400).send({ success: false, message: "Missing webhook signature or secret" });
    }

    try {
      const rawPayload = JSON.stringify(request.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawPayload)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.warn("⚠️ Invalid Razorpay webhook signature");
        return reply.status(400).send({ success: false, message: "Invalid signature" });
      }

      const event = (request.body as any)?.event;
      const payload = (request.body as any)?.payload?.payment?.entity;

      if (event === "payment.captured" && payload) {
        const orderId = payload.order_id;
        const paymentId = payload.id;

        // Idempotent database update
        const paymentRes = await query(
          "SELECT user_id, plan, status FROM payments WHERE razorpay_order = $1",
          [orderId]
        );

        if (paymentRes.rows.length > 0 && paymentRes.rows[0].status !== "captured") {
          const { user_id, plan } = paymentRes.rows[0];

          await query(
            `UPDATE payments SET status = 'captured', razorpay_payment = $1 WHERE razorpay_order = $2`,
            [paymentId, orderId]
          );

          await query(
            `UPDATE users SET plan = $1, plan_expires_at = NOW() + INTERVAL '30 days', updated_at = NOW() WHERE id = $2`,
            [plan, user_id]
          );

          console.log(`✅ Webhook processed: Plan ${plan} activated for user ${user_id}`);
        }
      }

      return reply.send({ status: "ok" });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
}
