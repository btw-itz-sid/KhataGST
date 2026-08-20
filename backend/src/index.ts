// backend/src/index.ts
// KhataGST Server — Main entry point

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import crypto from "crypto";

const server = Fastify({
  logger: true,
});

// ── Secret Validation ────────────────────────────────────────
const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret === "change-this-secret" || jwtSecret.length < 32)) {
  console.error("❌ FATAL: JWT_SECRET must be a secure, random string (min 32 chars) in production.");
  process.exit(1);
}
const resolvedJwtSecret = jwtSecret || "dev-local-secret-key-minimum-32-characters";

// ── Sentry Error Tracking (production) ───────────────────────
if (process.env.SENTRY_DSN) {
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.2,
    });
    console.log("🛡️ Sentry error tracking initialized");
  } catch {
    console.warn("⚠️ @sentry/node not installed — error tracking disabled");
  }
}

// ── Request ID middleware ─────────────────────────────────────
server.addHook("onRequest", async (request, reply) => {
  const requestId = (request.headers["x-request-id"] as string) || crypto.randomUUID();
  reply.header("X-Request-ID", requestId);
});

// ── Plugins register karo ────────────────────────────────────
server.register(cors, {
  origin: process.env.NODE_ENV === "production"
    ? (process.env.FRONTEND_URL || "https://app.khatagst.com")
    : true,
  credentials: true,
});

server.register(jwt, {
  secret: resolvedJwtSecret,
});

// JWT authenticate helper
server.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Login karo pehle" },
    });
  }
});

server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// ── Swagger API Documentation ───────────────────────────────
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";

server.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "KhataGST API",
      description: "AI-powered GST filing SaaS for Indian MSMEs",
      version: "1.0.0",
      contact: {
        name: "KhataGST Support",
        email: "support@khatagst.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.khatagst.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token in Authorization header",
        },
      },
    },
  },
});

server.register(swaggerUI, {
  routePrefix: "/api/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
});

// ── Multipart file uploads ───────────────────────────────────
import multipart from "@fastify/multipart";
server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── Uploads directory ensure karo ────────────────────────────
import * as fs from "fs";
import * as path from "path";
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Uploads directory ready: ${uploadsDir}`);
}

// ── Routes register karo ─────────────────────────────────────
import { authRoutes } from "./routes/auth.js";
import { partyRoutes } from "./routes/parties.js";
import { returnRoutes } from "./routes/returns.js";
import { scanRoutes } from "./routes/scans.js";
import { exportRoutes } from "./routes/export.js";
import { adminRoutes } from "./routes/admin.js";
import { gstRatesRoutes } from "./routes/gstRates.js";
import { paymentRoutes } from "./routes/payments.js";
import { businessRoutes } from "./routes/businesses.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { aiCaRoutes } from "./routes/aiCaRoutes.js";

server.register(authRoutes, { prefix: "/api/v1/auth" });
server.register(partyRoutes, { prefix: "/api/v1/parties" });
server.register(returnRoutes, { prefix: "/api/v1/returns" });
server.register(scanRoutes, { prefix: "/api/v1/scans" });
server.register(exportRoutes, { prefix: "/api/v1/export" });
server.register(adminRoutes, { prefix: "/api/v1/admin" });
server.register(gstRatesRoutes, { prefix: "/api/v1/gst-rates" });
server.register(paymentRoutes, { prefix: "/api/v1/payments" });
server.register(businessRoutes, { prefix: "/api/v1/businesses" });
server.register(invoiceRoutes, { prefix: "/api/v1/invoices" });
server.register(aiCaRoutes, { prefix: "/api/v1/ai-ca" });

// ── Health check — probes DB connectivity ────────────────────
import { probeHealth } from "./lib/db.js";

server.get("/health", async () => {
  const db = await probeHealth();
  return {
    status: db.ok ? "ok" : "degraded",
    app: "KhataGST",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    db: {
      connected: db.ok,
      latencyMs: db.latencyMs,
      ...(db.error ? { error: db.error } : {}),
    },
  };
});

// ── Server start karo ────────────────────────────────────────
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 KhataGST server running on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
