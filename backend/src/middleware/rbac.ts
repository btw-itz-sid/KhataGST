// src/middleware/rbac.ts
// Role-Based Access Control (RBAC) & Audit Logging Middleware

import { FastifyReply, FastifyRequest } from "fastify";
import { query } from "../lib/db.js";

export type UserRole = "owner" | "admin" | "ca" | "accountant" | "viewer";

export interface AuthenticatedUser {
  userId: string;
  phone: string;
  role?: UserRole;
}

/**
 * Middleware to enforce role-based access control.
 * Checks the user's assigned role in the database.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as AuthenticatedUser | undefined;
      if (!user || !user.userId) {
        return reply.status(401).send({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
      }

      // Fetch fresh role from DB to prevent stale token privilege issues
      const userRes = await query("SELECT role FROM users WHERE id = $1", [user.userId]);
      if (userRes.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User does not exist" },
        });
      }

      const currentRole = (userRes.rows[0].role || "owner") as UserRole;

      if (!allowedRoles.includes(currentRole)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Access denied. Requires one of roles: ${allowedRoles.join(", ")}`,
          },
        });
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: "AUTH_CHECK_FAILED", message: err.message || "Role authorization failed" },
      });
    }
  };
}

/**
 * Audit log helper to record sensitive system actions
 */
export async function logAuditEvent(params: {
  userId?: string;
  businessId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, business_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId || null,
        params.businessId || null,
        params.action,
        params.entityType,
        params.entityId || null,
        params.details ? JSON.stringify(params.details) : null,
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  } catch (err) {
    console.error("⚠️ Audit log recording failed:", err);
  }
}
