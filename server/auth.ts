import { storage } from "./storage";
import type { User, PublicUser } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";

// Sanitize user object by removing password hash
export function sanitizeUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.log(`[AUTH] User not found for email: ${email}`);
      return null;
    }
    
    if (!user.passwordHash) {
      console.log(`[AUTH] No password hash found for user: ${email}`);
      return null;
    }
    
    console.log(`[AUTH] Authenticating user: ${email}`);
    console.log(`[AUTH] Password provided length: ${password.length}`);
    console.log(`[AUTH] Hash length: ${user.passwordHash.length}`);
    console.log(`[AUTH] Hash starts with: ${user.passwordHash.substring(0, 7)}`);
    
    let isValid = false;
    
    // Check if password is stored as bcrypt hash (60 chars, starts with $2a$, $2b$, or $2y$)
    if (user.passwordHash.length === 60 && /^\$2[aby]\$/.test(user.passwordHash)) {
      // Use bcrypt comparison for hashed passwords
      isValid = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Direct comparison for plain text passwords (legacy support)
      isValid = password === user.passwordHash;
    }
    
    console.log(`[AUTH] Password valid: ${isValid}`);
    
    return isValid ? user : null;
  } catch (error) {
    console.error(`[AUTH] Authentication error for ${email}:`, error);
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function createUser(
  email: string, 
  name: string, 
  password: string, 
  role: string,
  department?: string | null,
  employeeId?: string | null
): Promise<User> {
  const passwordHash = await hashPassword(password);
  
  return storage.createUser({
    email,
    name,
    role,
    department: department || null,
    employeeId: employeeId || null,
    passwordHash,
  });
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
