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
  origin: true, // development mein sab allow
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
// Routes register karo
import { authRoutes } from "./routes/auth.js";
import { partyRoutes } from "./routes/parties.js";
import { returnRoutes } from "./routes/returns.js";
import { scanRoutes } from "./routes/scans.js";
import { exportRoutes } from "./routes/export.js";
import multipart from "@fastify/multipart";
server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

server.register(authRoutes, { prefix: "/api/v1/auth" });
server.register(partyRoutes, { prefix: "/api/v1/parties" });
server.register(returnRoutes, { prefix: "/api/v1/returns" });
server.register(scanRoutes, { prefix: "/api/v1/scans" });
server.register(exportRoutes, { prefix: "/api/v1/export" });
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
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
