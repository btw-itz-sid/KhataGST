// src/index.ts
// Server yahan se start hota hai
// Ye file sabse pehle run hoti hai

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";

const server = Fastify({
  logger: true, // terminal mein requests dikhenge
});

// ── Plugins register karo ────────────────────────────────────
server.register(cors, {
  // Production mein specific frontend URL allow karo
  // Development mein sab allow karo (local testing ke liye)
  origin: process.env.NODE_ENV === "production"
    ? (process.env.FRONTEND_URL || "https://app.khatagst.com")
    : true,
  credentials: true,
});

server.register(jwt, {
  secret: process.env.JWT_SECRET ?? "change-this-secret",
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
  max: 100,         // 100 requests
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

// Routes register karo
import { authRoutes } from "./routes/auth.js";
import { partyRoutes } from "./routes/parties.js";
import { returnRoutes } from "./routes/returns.js";
import { scanRoutes } from "./routes/scans.js";
import { exportRoutes } from "./routes/export.js";
import { adminRoutes } from "./routes/admin.js";
import { gstRatesRoutes } from "./routes/gstRates.js";
import { paymentRoutes } from "./routes/payments.js";
import multipart from "@fastify/multipart";
server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── Uploads directory ensure karo ──────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Uploads directory ready: ${uploadsDir}`);
}

server.register(authRoutes, { prefix: "/api/v1/auth" });
server.register(partyRoutes, { prefix: "/api/v1/parties" });
server.register(returnRoutes, { prefix: "/api/v1/returns" });
server.register(scanRoutes, { prefix: "/api/v1/scans" });
server.register(exportRoutes, { prefix: "/api/v1/export" });
server.register(adminRoutes, { prefix: "/api/v1/admin" });
server.register(gstRatesRoutes, { prefix: "/api/v1/gst-rates" });
server.register(paymentRoutes, { prefix: "/api/v1/payments" });
import { businessRoutes } from "./routes/businesses.js";
import { invoiceRoutes } from "./routes/invoices.js";

server.register(businessRoutes, { prefix: "/api/v1/businesses" });
server.register(invoiceRoutes, { prefix: "/api/v1/invoices" });

// ── Health check route ───────────────────────────────────────
server.get("/health", async () => {
  return {
    status: "ok",
    app: "KhataGST",
    time: new Date().toISOString(),
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
