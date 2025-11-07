import { storage } from "./storage";
import type { User } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function authenticateUser(email: string): Promise<User | null> {
  const user = await storage.getUserByEmail(email);
  return user || null;
}

export async function createOrGetUser(email: string, name: string, role: string): Promise<User> {
  let user = await storage.getUserByEmail(email);
  
  if (!user) {
    user = await storage.createUser({
      email,
      name,
      role,
      department: null,
    });
  }
  
  return user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    req.user = user;
    next();
  };
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user) {
      req.user = user;
    }
  }
  next();
}

// Extend express-session types
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}
