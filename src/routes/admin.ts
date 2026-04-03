// src/routes/admin.ts
// Admin ke liye dashboard — sabhi users, businesses, returns ka overview

import { FastifyInstance } from "fastify";
import * as db from "../lib/db";

// Admin check middleware
async function isAdmin(request: any): Promise<boolean> {
  try {
    const userId = request.user?.userId;
    if (!userId) return false;

    // Check karo agar admin ka email/role ho (yahan simple check hai, baarme role system banenge)
    // Filhaal: hardcoded admin check (production mein proper role table ho)
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e: string) => e.trim());
    const userResult = await db.query("SELECT email FROM users WHERE id = $1", [userId]);
    
    if (!userResult.rows[0]) return false;
    return adminEmails.includes(userResult.rows[0].email);
  } catch {
    return false;
  }
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Sab admin routes ke liye JWT verify zaroori hai
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

  // GET /api/v1/admin/dashboard
  // Dashboard mein kya dikhta hai:
  // - Total users, total businesses, active businesses
  // - Returns filed count, pending count
  // - Recent activity
  fastify.get("/dashboard", async (request, reply) => {
    const adminCheck = await isAdmin(request);
    if (!adminCheck) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin nahi ho" },
      });
    }

    try {
      // Total users count
      const usersResult = await db.query(
        "SELECT COUNT(*) as count FROM users"
      );
      const totalUsers = parseInt(usersResult.rows[0].count, 10);

      // Total businesses count
      const businessesResult = await db.query(
        "SELECT COUNT(*) as count FROM businesses WHERE is_active = true"
      );
      const totalActiveBusinesses = parseInt(businessesResult.rows[0].count, 10);

      // All businesses (active aur inactive)
      const allBusinessesResult = await db.query(
        "SELECT COUNT(*) as count FROM businesses"
      );
      const totalBusinesses = parseInt(allBusinessesResult.rows[0].count, 10);

      // Returns filed count
      const returnsFiledResult = await db.query(
        "SELECT COUNT(*) as count FROM gst_returns WHERE status = 'filed'"
      );
      const returnsFiled = parseInt(returnsFiledResult.rows[0].count, 10);

      // Returns pending count
      const returnsPendingResult = await db.query(
        "SELECT COUNT(*) as count FROM gst_returns WHERE status IN ('draft', 'computed')"
      );
      const returnsPending = parseInt(returnsPendingResult.rows[0].count, 10);

      // Bill scans stats
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

      // Recent users (last 7 days)
      const recentUsersResult = await db.query(
        `SELECT COUNT(*) as count FROM users 
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      const recentUsers = parseInt(recentUsersResult.rows[0].count, 10);

      // Recent businesses (last 7 days)
      const recentBusinessesResult = await db.query(
        `SELECT COUNT(*) as count FROM businesses 
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      const recentBusinesses = parseInt(recentBusinessesResult.rows[0].count, 10);

      // Users by plan
      const planResult = await db.query(
        `SELECT plan, COUNT(*) as count FROM users GROUP BY plan`
      );
      const usersByPlan: Record<string, number> = {};
      planResult.rows.forEach((row: any) => {
        usersByPlan[row.plan] = parseInt(row.count, 10);
      });

      reply.send({
        success: true,
        data: {
          overview: {
            totalUsers,
            totalBusinesses,
            totalActiveBusinesses,
            recentUsers,
            recentBusinesses,
          },
          returns: {
            filed: returnsFiled,
            pending: returnsPending,
          },
          scans,
          usersByPlan,
        },
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // GET /api/v1/admin/users
  // Sabhi users ka list with pagination
  fastify.get("/users", async (request, reply) => {
    const adminCheck = await isAdmin(request);
    if (!adminCheck) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin nahi ho" },
      });
    }

    const { limit = 20, offset = 0 } = request.query as any;
    const pageLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const pageOffset = Math.max(0, parseInt(offset) || 0);

    try {
      const result = await db.query(
        `SELECT id, phone, email, name, plan, created_at FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageLimit, pageOffset]
      );

      const countResult = await db.query("SELECT COUNT(*) as count FROM users");
      const total = parseInt(countResult.rows[0].count, 10);

      reply.send({
        success: true,
        data: {
          users: result.rows,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
          },
        },
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // GET /api/v1/admin/businesses
  // Sabhi businesses ka list with owner info
  fastify.get("/businesses", async (request, reply) => {
    const adminCheck = await isAdmin(request);
    if (!adminCheck) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin nahi ho" },
      });
    }

    const { limit = 20, offset = 0 } = request.query as any;
    const pageLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const pageOffset = Math.max(0, parseInt(offset) || 0);

    try {
      const result = await db.query(
        `SELECT 
          b.id, b.gstin, b.legal_name, b.trade_name, 
          b.state_code, b.is_active, b.business_type,
          u.phone, u.name as owner_name, u.plan,
          b.created_at
         FROM businesses b
         JOIN users u ON b.owner_id = u.id
         ORDER BY b.created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageLimit, pageOffset]
      );

      const countResult = await db.query("SELECT COUNT(*) as count FROM businesses");
      const total = parseInt(countResult.rows[0].count, 10);

      reply.send({
        success: true,
        data: {
          businesses: result.rows,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
          },
        },
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });

  // GET /api/v1/admin/returns
  // Sabhi GST returns ka list
  fastify.get("/returns", async (request, reply) => {
    const adminCheck = await isAdmin(request);
    if (!adminCheck) {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin nahi ho" },
      });
    }

    const { limit = 20, offset = 0, status } = request.query as any;
    const pageLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const pageOffset = Math.max(0, parseInt(offset) || 0);

    try {
      let statusFilter = "";
      let params: any[] = [pageLimit, pageOffset];

      if (status && ["draft", "computed", "filed", "error"].includes(status)) {
        statusFilter = "WHERE gr.status = $3";
        params = [pageLimit, pageOffset, status];
      }

      const result = await db.query(
        `SELECT 
          gr.id, gr.return_type, gr.tax_period, gr.status,
          gr.filed_at, gr.arn, gr.created_at,
          b.legal_name as business_name, b.gstin,
          u.phone, u.name as owner_name
         FROM gst_returns gr
         JOIN businesses b ON gr.business_id = b.id
         JOIN users u ON b.owner_id = u.id
         ${statusFilter}
         ORDER BY gr.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      );

      const countResult = await db.query(
        `SELECT COUNT(*) as count FROM gst_returns ${statusFilter}`,
        status ? [status] : []
      );
      const total = parseInt(countResult.rows[0].count, 10);

      reply.send({
        success: true,
        data: {
          returns: result.rows,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
          },
        },
      });
    } catch (err: any) {
      reply.status(500).send({
        success: false,
        error: { code: "SERVER_ERROR", message: err.message },
      });
    }
  });
}
