import { storage } from "./storage";
import type { Request } from "express";
import type { InsertAuditLog } from "@shared/schema";

/**
 * Log an audit event
 */
export async function logAudit(params: {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  changes?: any;
  req?: Request;
}): Promise<void> {
  try {
    const auditLog: InsertAuditLog = {
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      changes: params.changes || null,
      ipAddress: params.req ? getClientIp(params.req) : null,
      userAgent: params.req?.get("user-agent") || null,
    };

    await storage.createAuditLog(auditLog);
  } catch (error) {
    // Don't throw errors from audit logging - it should be non-blocking
    console.error("Audit logging failed:", error);
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Sanitize request body to remove sensitive data before logging
 */
function sanitizeBody(body: any, path: string): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  
  // Never log passwords or tokens
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'api_key'];
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // For login/auth endpoints, only log the email
  if (path.includes('/auth/login') || path.includes('/auth/register')) {
    return { email: sanitized.email };
  }
  
  return sanitized;
}

/**
 * Audit middleware to log all requests
 */
export function auditMiddleware(req: Request, res: any, next: any) {
  // Only log important actions
  const shouldLog = [
    "POST", "PATCH", "PUT", "DELETE"
  ].includes(req.method);

  if (!shouldLog) {
    return next();
  }

  // Log after response is sent
  const originalSend = res.send;
  res.send = function (data: any) {
    res.send = originalSend; // Restore original
    
    // Log the action
    if (res.statusCode < 400) {
      const action = `${req.method} ${req.path}`;
      const userId = (req.session as any)?.userId;
      
      logAudit({
        userId,
        action,
        entityType: extractEntityType(req.path),
        entityId: extractEntityId(req.path),
        changes: req.method !== "GET" ? sanitizeBody(req.body, req.path) : null,
        req,
      });
    }
    
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Extract entity type from API path
 */
function extractEntityType(path: string): string {
  if (path.includes("/gaps")) return "gap";
  if (path.includes("/users")) return "user";
  if (path.includes("/sops")) return "sop";
  if (path.includes("/comments")) return "comment";
  if (path.includes("/form-templates")) return "form_template";
  if (path.includes("/auth/login")) return "auth";
  if (path.includes("/auth/logout")) return "auth";
  return "unknown";
}

/**
 * Extract entity ID from API path
 */
function extractEntityId(path: string): number | undefined {
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Log gap creation
 */
export async function logGapCreation(userId: number, gapId: number, gapData: any, req?: Request) {
  await logAudit({
    userId,
    action: "CREATE_GAP",
    entityType: "gap",
    entityId: gapId,
    changes: { created: gapData },
    req,
  });
}

/**
 * Log gap assignment
 */
export async function logGapAssignment(userId: number, gapId: number, assignedToId: number, req?: Request) {
  await logAudit({
    userId,
    action: "ASSIGN_GAP",
    entityType: "gap",
    entityId: gapId,
    changes: { assignedToId },
    req,
  });
}

/**
 * Log gap status change
 */
export async function logGapStatusChange(userId: number, gapId: number, oldStatus: string, newStatus: string, req?: Request) {
  await logAudit({
    userId,
    action: "UPDATE_GAP_STATUS",
    entityType: "gap",
    entityId: gapId,
    changes: { before: { status: oldStatus }, after: { status: newStatus } },
    req,
  });
}

/**
 * Log user login
 */
export async function logUserLogin(userId: number, email: string, req?: Request) {
  await logAudit({
    userId,
    action: "LOGIN",
    entityType: "auth",
    entityId: userId,
    changes: { email },
    req,
  });
}

/**
 * Log user logout
 */
export async function logUserLogout(userId: number, req?: Request) {
  await logAudit({
    userId,
    action: "LOGOUT",
    entityType: "auth",
    entityId: userId,
    req,
  });
}
