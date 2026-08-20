// backend/src/routes/admin.ts
// Admin dashboard — DB-driven RBAC with requireRole middleware

import { FastifyInstance } from "fastify";
import * as db from "../lib/db.js";
import { requireRole } from "../middleware/rbac.js";

export async function adminRoutes(fastify: FastifyInstance) {
  // JWT verify for all admin routes
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ 
        success: false,
        error: { code: "UNAUTHORIZED", message: "Login karo pehle" } 
      });
    }
  });

  // ✅ RBAC: All admin routes require 'admin' or 'owner' role
  fastify.addHook("preHandler", requireRole(["admin", "owner"]));

  // GET /api/v1/admin/dashboard
  fastify.get("/dashboard", async (_request, reply) => {
    try {
      const usersResult = await db.query("SELECT COUNT(*) as count FROM users");
      const totalUsers = parseInt(usersResult.rows[0].count, 10);

      const businessesResult = await db.query(
        "SELECT COUNT(*) as count FROM businesses WHERE is_active = true"
      );
      const totalActiveBusinesses = parseInt(businessesResult.rows[0].count, 10);

      const allBusinessesResult = await db.query(
        "SELECT COUNT(*) as count FROM businesses"
      );
      const totalBusinesses = parseInt(allBusinessesResult.rows[0].count, 10);

      const returnsFiledResult = await db.query(
        "SELECT COUNT(*) as count FROM gst_returns WHERE status = 'filed'"
      );
      const returnsFiled = parseInt(returnsFiledResult.rows[0].count, 10);

      const returnsPendingResult = await db.query(
        "SELECT COUNT(*) as count FROM gst_returns WHERE status IN ('draft', 'computed')"
      );
      const returnsPending = parseInt(returnsPendingResult.rows[0].count, 10);

      const scansResult = await db.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'done' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM bill_scans`
      );
      const scansData = scansResult.rows[0];
      const scans = {
        total: parseInt(scansData.total, 10),
        successful: parseInt(scansData.successful, 10),
        failed: parseInt(scansData.failed, 10),
      };

      const recentUsersResult = await db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      const recentUsers = parseInt(recentUsersResult.rows[0].count, 10);

      const recentBusinessesResult = await db.query(
        `SELECT COUNT(*) as count FROM businesses 
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      const recentBusinesses = parseInt(recentBusinessesResult.rows[0].count, 10);

      const planResult = await db.query(
        `SELECT plan, COUNT(*) as count FROM users GROUP BY plan`
      );
      const usersByPlan: Record<string, number> = {};
      planResult.rows.forEach((row: any) => {
        usersByPlan[row.plan] = parseInt(row.count, 10);
      });

      return reply.send({
        success: true,
        data: {
          users: {
            total: totalUsers,
            recent_7d: recentUsers,
            by_plan: usersByPlan,
          },
          businesses: {
            total: totalBusinesses,
            active: totalActiveBusinesses,
            recent_7d: recentBusinesses,
          },
          returns: {
            filed: returnsFiled,
            pending: returnsPending,
          },
          scans,
        },
      });
    } catch (err: any) {
      console.error("Admin dashboard error:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_ERROR", message: "Dashboard data load nahi ho paya" },
      });
    }
  });

  // GET /api/v1/admin/users
  fastify.get("/users", async (request, reply) => {
    const { page = "1", limit = "20" } = request.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const usersResult = await db.query(
        `SELECT id, phone, name, email, plan, role, created_at 
         FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      );

      const countResult = await db.query("SELECT COUNT(*) as count FROM users");
      const total = parseInt(countResult.rows[0].count, 10);

      return reply.send({
        success: true,
        data: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err: any) {
      console.error("Admin users list error:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_ERROR", message: "Users load nahi ho paye" },
      });
    }
  });

  // GET /api/v1/admin/businesses
  fastify.get("/businesses", async (request, reply) => {
    const { page = "1", limit = "20" } = request.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const result = await db.query(
        `SELECT b.*, u.phone as owner_phone, u.name as owner_name
         FROM businesses b
         JOIN users u ON b.user_id = u.id
         ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      );

      const countResult = await db.query("SELECT COUNT(*) as count FROM businesses");
      const total = parseInt(countResult.rows[0].count, 10);

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err: any) {
      console.error("Admin businesses list error:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_ERROR", message: "Businesses load nahi ho paye" },
      });
    }
  });

  // GET /api/v1/admin/returns
  fastify.get("/returns", async (request, reply) => {
    const { page = "1", limit = "20" } = request.query as any;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const result = await db.query(
        `SELECT r.*, b.legal_name as business_name, b.gstin
         FROM gst_returns r
         JOIN businesses b ON r.business_id = b.id
         ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
        [parseInt(limit), offset]
      );

      const countResult = await db.query("SELECT COUNT(*) as count FROM gst_returns");
      const total = parseInt(countResult.rows[0].count, 10);

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err: any) {
      console.error("Admin returns list error:", err);
      return reply.status(500).send({
        success: false,
        error: { code: "DB_ERROR", message: "Returns load nahi ho paye" },
      });
    }
  });
}
