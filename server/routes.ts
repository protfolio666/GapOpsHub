import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { authenticateUser, createUser, hashPassword, requireAuth, requireRole, attachUser, sanitizeUser } from "./auth";
import { findSimilarGapsWithAI, suggestSOPsWithAI } from "./openrouter-ai";
import { sendGapAssignmentEmail, sendGapResolutionEmail, sendTATExtensionRequestEmail, sendGapMarkedAsDuplicateEmail } from "./email-service";
import { logGapCreation, logGapAssignment, logGapStatusChange, logUserLogin, logUserLogout } from "./audit-logger";
import { generateExcelReport, type GapWithRelations } from "./excel-export";
import type { Gap } from "@shared/schema";
import { z } from "zod";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import archiver from "archiver";

const mkdir = promisify(fs.mkdir);

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
(async () => {
  try {
    await mkdir(uploadDir, { recursive: true });
  } catch (error) {
    console.error("Failed to create uploads directory:", error);
  }
})();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ 
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Validation schemas
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(["Admin", "Management", "QA/Ops", "POC"]).optional(),
  department: z.string().nullable().optional(),
  employeeId: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket setup for real-time comments
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL || "https://yourdomain.com" : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // WebSocket authentication using session
  io.engine.use((req: any, res: any, next: any) => {
    const isHandshake = req._query && req._query.sid === undefined;
    if (!isHandshake) return next();
    
    // Find and run session middleware, properly awaiting it
    const sessionLayer = (app as any)._router.stack.find(
      (layer: any) => layer.name === 'session'
    );
    
    if (sessionLayer) {
      sessionLayer.handle(req, res, next);
    } else {
      next();
    }
  });

  io.use(async (socket: any, next) => {
    const req = socket.request;
    
    // Check if session exists and has authenticated user
    if (!req.session || !req.session.userId) {
      return next(new Error("Unauthorized - No valid session"));
    }

    // Verify user exists
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return next(new Error("Unauthorized - User not found"));
    }

    socket.userId = user.id;
    socket.userRole = user.role;
    next();
  });

  io.on("connection", (socket: any) => {
    console.log(`User ${socket.userId} connected to WebSocket`);

    socket.on("join-gap", async (gapId: string) => {
      try {
        const gap = await storage.getGap(Number(gapId));
        if (!gap) {
          socket.emit("error", { message: "Gap not found" });
          return;
        }

        // Verify user has access to this gap
        const user = await storage.getUser(socket.userId);
        if (!user) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // RBAC: Same access control as GET /api/gaps/:id
        const isAssignedPoc = await storage.isUserAssignedPoc(gap.id, user.id);
        if (user.role !== "Admin" && user.role !== "Management") {
          if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
            socket.emit("error", { message: "Access denied: You can only join gaps you reported" });
            return;
          }
          if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
            socket.emit("error", { message: "Access denied: You can only join gaps assigned to you" });
            return;
          }
        }

        socket.join(`gap-${gapId}`);
        console.log(`User ${socket.userId} joined gap room: ${gapId}`);
      } catch (error) {
        console.error("Error joining gap room:", error);
        socket.emit("error", { message: "Failed to join gap room" });
      }
    });

    socket.on("leave-gap", (gapId: string) => {
      socket.leave(`gap-${gapId}`);
      console.log(`User ${socket.userId} left gap room: ${gapId}`);
    });

    socket.on("disconnect", () => {
      console.log(`User ${socket.userId} disconnected from WebSocket`);
    });
  });

  // Attach WebSocket to app for use in routes
  (app as any).io = io;

  // Middleware to attach user to requests
  app.use(attachUser);

  // ==================== FILE UPLOAD ROUTES ====================

  // Upload files endpoint
  app.post("/api/files/upload", requireAuth, upload.array("files", 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files)) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        path: `/api/files/download/${file.filename}`,
      }));

      return res.json({ files });
    } catch (error) {
      console.error("File upload error:", error);
      return res.status(500).json({ message: "File upload failed" });
    }
  });

  // Download/view file endpoint with gap authorization
  app.get("/api/files/download/:filename", requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      const { gapId } = req.query;

      if (!gapId) {
        return res.status(400).json({ message: "Gap ID required for file download" });
      }

      // Verify gap exists and user has access
      const gap = await storage.getGap(Number(gapId));
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Same access control as GET /api/gaps/:id
      const isAssignedPoc = await storage.isUserAssignedPoc(gap.id, user.id);
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only download files from gaps you reported" });
        }
        if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
          return res.status(403).json({ message: "Access denied: You can only download files from gaps assigned to you" });
        }
      }

      // Verify the file belongs to this gap
      const gapAttachments = await storage.getAllGapAttachments(Number(gapId));
      const fileExists = gapAttachments.some((att: any) => att.filename === filename);

      if (!fileExists) {
        return res.status(403).json({ message: "File does not belong to this gap" });
      }

      // Prevent path traversal
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const filePath = path.join(uploadDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Get original filename from the stored filename (remove timestamp prefix)
      const originalName = filename.substring(filename.indexOf("-") + 1);
      
      // Set content disposition for download
      res.setHeader("Content-Disposition", `inline; filename="${originalName}"`);
      
      return res.sendFile(filePath);
    } catch (error) {
      console.error("File download error:", error);
      return res.status(500).json({ message: "File download failed" });
    }
  });

  // Download all gap attachments as zip
  app.get("/api/gaps/:id/attachments/download", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);

      // Verify gap exists and user has access
      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Same access control as GET /api/gaps/:id
      const isAssignedPoc = await storage.isUserAssignedPoc(gapId, user.id);
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only download attachments from gaps you reported" });
        }
        if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
          return res.status(403).json({ message: "Access denied: You can only download attachments from gaps assigned to you" });
        }
      }

      // Get all attachments for this gap
      const attachments = await storage.getAllGapAttachments(gapId);

      if (attachments.length === 0) {
        return res.status(404).json({ message: "No attachments found for this gap" });
      }

      // Size and count limits
      const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB
      const MAX_COUNT = 100;

      if (attachments.length > MAX_COUNT) {
        return res.status(413).json({ message: `Too many attachments (max ${MAX_COUNT})` });
      }

      // Set response headers
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="gap-${gap.gapId}-attachments.zip"`);

      // Create zip archive
      const archive = archiver("zip", {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          return res.status(500).json({ message: "Failed to create archive" });
        }
      });

      // Pipe archive to response
      archive.pipe(res);

      let totalSize = 0;

      // Add each attachment to the archive
      for (const attachment of attachments) {
        const filename = attachment.filename;
        
        // Prevent path traversal
        if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
          console.warn("Skipping suspicious filename:", filename);
          continue;
        }

        const filePath = path.join(uploadDir, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.warn("File not found, skipping:", filePath);
          continue;
        }

        // Check file size
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (totalSize > MAX_TOTAL_SIZE) {
          archive.destroy();
          if (!res.headersSent) {
            return res.status(413).json({ message: "Total attachment size exceeds limit" });
          }
          return;
        }

        // Add file to archive with organized folder structure
        const folderName = attachment.source === "resolution" ? "resolution" : `comment-${attachment.sourceId}`;
        const archivePath = `${folderName}/${attachment.originalName || filename}`;
        
        archive.file(filePath, { name: archivePath });
      }

      // Finalize the archive
      await archive.finalize();

    } catch (error) {
      console.error("Bulk download error:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to download attachments" });
      }
    }
  });

  // ==================== AUTH ROUTES ====================
  
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Authenticate user with password verification
      const user = await authenticateUser(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set and explicitly save session before responding
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Log successful login
      await logUserLogin(user.id, user.email, req);
      
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Registration endpoint for creating new users (Admin only)
  app.post("/api/auth/register", requireRole("Admin"), async (req, res) => {
    try {
      const { email, name, password, role, department, employeeId } = req.body;
      
      if (!email || !password || !name || !role) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user doesn't already exist
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Check if employeeId is unique (if provided)
      if (employeeId) {
        const existingEmployeeId = await storage.getUserByEmployeeId(employeeId);
        if (existingEmployeeId) {
          return res.status(400).json({ message: "Employee ID already exists" });
        }
      }

      // Validate role
      const validRoles = ["Admin", "Management", "QA/Ops", "POC"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await createUser(email, name, password, role, department, employeeId);
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    
    // Log logout before destroying session
    if (userId) {
      await logUserLogout(userId, req);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Debug endpoint to test database connection
  app.get("/api/debug/db-test", async (req, res) => {
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
      
      console.log('[DB-TEST] Testing database connection...');
      console.log('[DB-TEST] DATABASE_URL configured:', !!process.env.DATABASE_URL);
      console.log('[DB-TEST] Masked URL:', maskedUrl);
      console.log('[DB-TEST] Is Neon DB:', dbUrl.includes('neon.tech'));
      
      // Test a simple query
      const result = await storage.getAllUsers();
      
      return res.json({ 
        success: true, 
        message: "Database connection working",
        userCount: result.length,
        dbType: dbUrl.includes('neon.tech') ? 'Neon' : 'PostgreSQL',
        maskedUrl 
      });
    } catch (error: any) {
      console.error('[DB-TEST] Database connection failed:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message,
        code: error.code,
        detail: error.detail
      });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Get current user error:", error);
      return res.status(500).json({ message: "Failed to get user" });
    }
  });

  // ==================== USER ROUTES ====================
  
  app.get("/api/users", requireRole("Admin"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      return res.json({ users: users.map(sanitizeUser) });
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Get POC users - accessible to Admin, Management, and POC roles
  app.get("/api/pocs", requireRole("Admin", "Management", "POC"), async (req, res) => {
    try {
      const pocUsers = await storage.getUsersByRole("POC");
      return res.json({ users: pocUsers.map(sanitizeUser) });
    } catch (error) {
      console.error("Get POC users error:", error);
      return res.status(500).json({ message: "Failed to get POC users" });
    }
  });

  app.get("/api/users/role/:role", requireAuth, async (req, res) => {
    try {
      const { role } = req.params;
      const users = await storage.getUsersByRole(role);
      return res.json({ users: users.map(sanitizeUser) });
    } catch (error) {
      console.error("Get users by role error:", error);
      return res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.patch("/api/users/:id", requireRole("Admin"), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      
      // Validate request body
      const validation = updateUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid update data", 
          errors: validation.error.errors 
        });
      }

      const { email, name, role, department, employeeId, password } = validation.data;

      // Check if employeeId is unique (if being updated and not null)
      if (employeeId !== undefined && employeeId !== null) {
        const existingEmployee = await storage.getUserByEmployeeId(employeeId);
        if (existingEmployee && existingEmployee.id !== userId) {
          return res.status(400).json({ message: "Employee ID already exists" });
        }
      }

      const updates: Partial<{
        email: string;
        name: string;
        role: string;
        department: string | null;
        employeeId: string | null;
        passwordHash: string;
      }> = {};

      if (email !== undefined) updates.email = email;
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (department !== undefined) updates.department = department;
      if (employeeId !== undefined) updates.employeeId = employeeId;
      if (password !== undefined) {
        console.log(`[AUTH] Hashing new password for user ${userId}, password length: ${password.length}`);
        const passwordHash = await hashPassword(password);
        console.log(`[AUTH] Generated hash length: ${passwordHash.length}, starts with: ${passwordHash.substring(0, 7)}`);
        updates.passwordHash = passwordHash;
      }

      const updatedUser = await storage.updateUser(userId, updates);
      return res.json({ user: sanitizeUser(updatedUser) });
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireRole("Admin"), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      await storage.deleteUser(userId);
      return res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ==================== GAP ROUTES ====================
  
  app.get("/api/gaps", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { status } = req.query;
      let gaps: Gap[] = [];

      // RBAC: Filter gaps based on user role
      if (user.role === "Admin" || user.role === "Management") {
        // Admin & Management: See all gaps
        if (status) {
          gaps = await storage.getGapsByStatus(status as string);
        } else {
          gaps = await storage.getAllGaps();
        }
      } else if (user.role === "QA/Ops") {
        // QA/Ops: Only see gaps they reported
        gaps = await storage.getGapsByReporter(user.id);
        if (status) {
          gaps = gaps.filter(g => g.status === status);
        }
      } else if (user.role === "POC") {
        // POC: See gaps where they are primary assignee or in the POC list
        gaps = await storage.getGapsByPoc(user.id);
        if (status) {
          gaps = gaps.filter(g => g.status === status);
        }
      } else {
        gaps = [];
      }

      // Enrich gaps with reporter and assignee information
      const gapsWithDetails = await Promise.all(
        gaps.map(async (gap) => {
          const reporter = gap.reporterId ? await storage.getUser(gap.reporterId) : null;
          const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : null;
          return {
            ...gap,
            reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email, role: reporter.role } : null,
            assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role } : null,
          };
        })
      );

      return res.json({ gaps: gapsWithDetails });
    } catch (error) {
      console.error("Get gaps error:", error);
      return res.status(500).json({ message: "Failed to get gaps" });
    }
  });

  // Get gaps reported by current user
  app.get("/api/gaps/my", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { status, search } = req.query;
      let gaps = await storage.getGapsByReporter(user.id);

      if (status && status !== 'All') {
        gaps = gaps.filter(g => g.status === status);
      }

      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        gaps = gaps.filter(g => 
          g.title.toLowerCase().includes(searchLower) ||
          g.description.toLowerCase().includes(searchLower) ||
          g.gapId.toLowerCase().includes(searchLower)
        );
      }

      const gapsWithDetails = await Promise.all(
        gaps.map(async (gap) => {
          const reporter = gap.reporterId ? await storage.getUser(gap.reporterId) : null;
          const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : null;
          return {
            ...gap,
            reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email } : null,
            assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
          };
        })
      );

      return res.json({ gaps: gapsWithDetails });
    } catch (error) {
      console.error("Get my gaps error:", error);
      return res.status(500).json({ message: "Failed to get gaps" });
    }
  });

  // Get metrics for current user's gaps
  app.get("/api/gaps/my/metrics", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const gaps = await storage.getGapsByReporter(user.id);
      
      const totalRaised = gaps.length;
      const validated = gaps.filter(g => ['Assigned', 'InProgress', 'Resolved', 'Closed'].includes(g.status)).length;
      const resolved = gaps.filter(g => ['Resolved', 'Closed'].includes(g.status)).length;
      
      // SOP impact will be calculated when gap-SOP linking is implemented
      const sopImpact = 0;

      const smoothnessScore = totalRaised > 0 ? (validated / totalRaised) * 100 : 0;

      return res.json({
        totalRaised,
        validated,
        resolved,
        sopImpact,
        smoothnessScore: parseFloat(smoothnessScore.toFixed(1)),
      });
    } catch (error) {
      console.error("Get metrics error:", error);
      return res.status(500).json({ message: "Failed to get metrics" });
    }
  });

  app.get("/api/gaps/:id", requireAuth, async (req, res) => {
    try {
      const gap = await storage.getGap(Number(req.params.id));
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Check if user has permission to view this gap
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only view gaps you reported" });
        }
        if (user.role === "POC") {
          // Check both primary assignedToId and gap_pocs table
          const isAssignedPoc = await storage.isUserAssignedPoc(gap.id, user.id);
          if (gap.assignedToId !== user.id && !isAssignedPoc) {
            return res.status(403).json({ message: "Access denied: You can only view gaps assigned to you" });
          }
        }
      }

      // Get reporter and assignee info (sanitized)
      const reporter = await storage.getUser(gap.reporterId);
      const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : null;
      
      // Get all assigned POCs
      const pocs = await storage.getGapPocs(gap.id);

      return res.json({ 
        gap,
        reporter: reporter ? sanitizeUser(reporter) : null,
        assignee: assignee ? sanitizeUser(assignee) : null,
        pocs
      });
    } catch (error) {
      console.error("Get gap error:", error);
      return res.status(500).json({ message: "Failed to get gap" });
    }
  });

  app.post("/api/gaps", requireAuth, async (req, res) => {
    try {
      const { 
        title, 
        description, 
        department, 
        priority, 
        severity, 
        attachments,
        formTemplateId,
        templateVersion,
        formResponsesJson 
      } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      // If template-based, validate template exists
      if (formTemplateId) {
        const template = await storage.getFormTemplate(formTemplateId);
        if (!template) {
          return res.status(400).json({ message: "Invalid form template" });
        }
      }

      const gap = await storage.createGap({
        title,
        description,
        department: department || null,
        priority: priority || "Medium",
        severity: severity || null,
        reporterId: req.session.userId!,
        assignedToId: null,
        formTemplateId: formTemplateId || null,
        templateVersion: templateVersion || null,
        formResponsesJson: formResponsesJson || null,
        tatDeadline: null,
        status: "PendingAI",
        aiProcessed: false,
        attachments: attachments || [],
      });

      // Log gap creation
      await logGapCreation(req.session.userId!, gap.id, { title, description, department, priority }, req);

      // Calculate similarity with existing gaps and suggest SOPs using OpenRouter AI
      // Run asynchronously to not block response
      setImmediate(async () => {
        try {
          // Run similarity detection and SOP suggestion in parallel
          const [allGaps, allSOPs] = await Promise.all([
            storage.getAllGaps(),
            storage.getAllSops()
          ]);

          const otherGaps = allGaps.filter(g => g.id !== gap.id && g.status !== "Closed");
          const activeSOPs = allSOPs.filter(sop => sop.active);

          // Run both AI operations in parallel
          const [similarGaps, sopSuggestions] = await Promise.all([
            findSimilarGapsWithAI(gap, otherGaps, 60),
            suggestSOPsWithAI(gap, activeSOPs.map(sop => ({
              id: sop.id,
              title: sop.title,
              description: sop.description || undefined,
              content: sop.content
            })))
          ]);
          
          // Store similar gaps
          for (const { gap: similarGap, score } of similarGaps) {
            // Store bidirectional similarity for better lookup
            await storage.createSimilarGap({
              gapId: gap.id,
              similarGapId: similarGap.id,
              similarityScore: score,
            });
            // Also store reverse relationship
            await storage.createSimilarGap({
              gapId: similarGap.id,
              similarGapId: gap.id,
              similarityScore: score,
            });
          }

          // Update gap with SOP suggestions and mark as processed
          await storage.updateGap(gap.id, { 
            aiProcessed: true,
            status: "NeedsReview",
            sopSuggestions: sopSuggestions as any
          });
        } catch (error) {
          console.error("AI processing error:", error);
          // Still mark as needs review even if AI fails
          await storage.updateGap(gap.id, { 
            aiProcessed: true,
            status: "NeedsReview" 
          });
        }
      });

      return res.json({ gap });
    } catch (error) {
      console.error("Create gap error:", error);
      return res.status(500).json({ message: "Failed to create gap" });
    }
  });

  app.patch("/api/gaps/:id", requireAuth, async (req, res) => {
    try {
      // If title or description changed, invalidate similarity cache
      const hasContentChange = req.body.title || req.body.description;
      
      // If status is changing to InProgress, set inProgressAt timestamp
      const updateData = { ...req.body, updatedById: req.session.userId };
      if (req.body.status === "InProgress") {
        updateData.inProgressAt = new Date();
      }
      if (req.body.status === "Closed" && !updateData.closedById) {
        updateData.closedAt = new Date();
        updateData.closedById = req.session.userId;
      }
      
      const gap = await storage.updateGap(Number(req.params.id), updateData);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Invalidate and recompute similarities if content changed
      if (hasContentChange) {
        setImmediate(async () => {
          try {
            await storage.deleteSimilarGapsByGapId(gap.id);
            const allGaps = await storage.getAllGaps();
            const otherGaps = allGaps.filter(g => g.id !== gap.id && g.status !== "Closed");
            const similarGaps = await findSimilarGapsWithAI(gap, otherGaps, 60);
            
            for (const { gap: similarGap, score } of similarGaps) {
              await storage.createSimilarGap({
                gapId: gap.id,
                similarGapId: similarGap.id,
                similarityScore: score,
              });
              // Also store reverse relationship
              await storage.createSimilarGap({
                gapId: similarGap.id,
                similarGapId: gap.id,
                similarityScore: score,
              });
            }
          } catch (error) {
            console.error("Similarity recomputation error:", error);
          }
        });
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Update gap error:", error);
      return res.status(500).json({ message: "Failed to update gap" });
    }
  });

  app.post("/api/gaps/:id/assign", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { assignedToId, tatDeadline, notes, priority } = req.body;

      if (!assignedToId) {
        return res.status(400).json({ message: "Assignee is required" });
      }

      // Verify gap exists and user has permission
      const existingGap = await storage.getGap(Number(req.params.id));
      if (!existingGap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const updateData: any = {
        assignedToId,
        tatDeadline: tatDeadline ? new Date(tatDeadline) : null,
        status: "Assigned",
        assignedAt: new Date(),
      };
      
      // Include priority if provided
      if (priority) {
        updateData.priority = priority;
      }

      const gap = await storage.updateGap(Number(req.params.id), updateData);

      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      await storage.createGapAssignment({
        gapId: gap.id,
        assignedToId,
        assignedById: req.session.userId!,
        notes: notes || null,
      });

      // Log assignment
      await logGapAssignment(req.session.userId!, gap.id, assignedToId, req);

      // Send email notification to assignee with CC to all POCs
      const assignee = await storage.getUser(assignedToId);
      if (assignee) {
        // Fetch all POCs for this gap to CC them
        const pocs = await storage.getGapPocs(gap.id);
        const ccEmails = pocs
          .filter(poc => poc.userId !== assignedToId) // Don't CC the primary assignee
          .map(poc => poc.user?.email || "")
          .filter(email => email); // Remove empty emails
        
        await sendGapAssignmentEmail(
          assignee.name,
          assignee.email,
          gap.gapId,
          gap.title,
          gap.priority,
          gap.tatDeadline || undefined,
          ccEmails.length > 0 ? ccEmails : undefined
        );
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Assign gap error:", error);
      return res.status(500).json({ message: "Failed to assign gap" });
    }
  });

  app.post("/api/gaps/:id/mark-duplicate", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { duplicateOfId } = req.body;

      if (!duplicateOfId) {
        return res.status(400).json({ message: "Original gap ID is required" });
      }

      const gapId = Number(req.params.id);
      const originalGapId = Number(duplicateOfId);

      // Verify both gaps exist
      const duplicateGap = await storage.getGap(gapId);
      if (!duplicateGap) {
        return res.status(404).json({ message: "Gap to mark as duplicate not found" });
      }

      const originalGap = await storage.getGap(originalGapId);
      if (!originalGap) {
        return res.status(404).json({ message: "Original gap not found" });
      }

      // Update the duplicate gap
      const gap = await storage.updateGap(gapId, {
        duplicateOfId: originalGapId,
        status: "Closed",
        closedAt: new Date(),
        closedById: req.session.userId!,
      });

      if (!gap) {
        return res.status(404).json({ message: "Failed to update gap" });
      }

      // Log the duplicate marking
      await storage.createAuditLog({
        userId: req.session.userId!,
        action: "gap_marked_duplicate",
        entityType: "gap",
        entityId: gapId,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      // Send email notification to reporter with closer's info
      const reporter = await storage.getUser(duplicateGap.reporterId);
      const closer = await storage.getUser(req.session.userId!);
      
      console.log(`[Email] Attempting to send duplicate notification to ${reporter?.email}`);
      
      if (reporter && closer) {
        const emailSent = await sendGapMarkedAsDuplicateEmail(
          reporter.name,
          reporter.email,
          duplicateGap.gapId,
          duplicateGap.title,
          originalGap.gapId,
          originalGap.title,
          closer.name,
          closer.email
        );
        console.log(`[Email] Duplicate notification ${emailSent ? 'sent successfully' : 'failed'} to ${reporter.email}`);
      } else {
        console.log(`[Email] Cannot send duplicate notification - reporter: ${!!reporter}, closer: ${!!closer}`);
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Mark as duplicate error:", error);
      return res.status(500).json({ message: "Failed to mark gap as duplicate" });
    }
  });

  // Get who closed a gap as duplicate (from audit logs)
  app.get("/api/gaps/:id/closer", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      
      // Get audit logs for this gap
      const auditLogs = await storage.getAuditLogsByEntity("gap", gapId);
      
      // Find the gap_marked_duplicate action
      const duplicateLog = auditLogs.find(log => log.action === "gap_marked_duplicate");
      
      if (!duplicateLog || !duplicateLog.userId) {
        return res.json({ closer: null });
      }
      
      // Get the user who performed the action
      const closer = await storage.getUser(duplicateLog.userId);
      
      if (!closer) {
        return res.json({ closer: null });
      }
      
      return res.json({ 
        closer: {
          name: closer.name,
          email: closer.email
        }
      });
    } catch (error) {
      console.error("Get closer error:", error);
      return res.status(500).json({ message: "Failed to get closer information" });
    }
  });

  // Get all POCs for a gap
  app.get("/api/gaps/:id/pocs", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      const gap = await storage.getGap(gapId);
      
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Same access control as GET /api/gaps/:id
      const isAssignedPoc = await storage.isUserAssignedPoc(gapId, user.id);
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only view gaps you reported" });
        }
        if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
          return res.status(403).json({ message: "Access denied: You can only view gaps assigned to you" });
        }
      }

      const pocs = await storage.getGapPocs(gapId);
      return res.json({ pocs });
    } catch (error) {
      console.error("Get gap POCs error:", error);
      return res.status(500).json({ message: "Failed to get gap POCs" });
    }
  });

  // Add a POC to a gap
  app.post("/api/gaps/:id/pocs", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      const { userId, isPrimary } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Check permissions: Admin, Management, or existing POC can add POCs
      const isExistingPoc = await storage.isUserAssignedPoc(gapId, user.id);
      if (!["Admin", "Management"].includes(user.role) && !isExistingPoc) {
        return res.status(403).json({ message: "Only Admin, Management, or assigned POCs can add more POCs" });
      }

      // Check if POC user exists and is actually a POC role
      const pocUser = await storage.getUser(userId);
      if (!pocUser) {
        return res.status(404).json({ message: "User to be assigned not found" });
      }
      if (pocUser.role !== "POC") {
        return res.status(400).json({ message: "User must have POC role" });
      }

      // Check if already assigned
      const alreadyAssigned = await storage.isUserAssignedPoc(gapId, userId);
      if (alreadyAssigned) {
        return res.status(400).json({ message: "User is already assigned as POC to this gap" });
      }

      // If setting as primary, clear any existing primary flags to ensure only one primary POC
      if (isPrimary) {
        const existingPocs = await storage.getGapPocs(gapId);
        for (const existingPoc of existingPocs) {
          if (existingPoc.isPrimary) {
            await storage.db.execute(sql`
              UPDATE gap_pocs 
              SET is_primary = false 
              WHERE gap_id = ${gapId} AND user_id = ${existingPoc.userId}
            `);
          }
        }
      }

      const poc = await storage.addGapPoc({
        gapId,
        userId,
        addedById: user.id,
        isPrimary: isPrimary || false,
      });

      // Log POC addition
      await storage.createAuditLog({
        userId: user.id,
        action: "gap_poc_added",
        entityType: "gap",
        entityId: gapId,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      return res.json({ poc });
    } catch (error) {
      console.error("Add gap POC error:", error);
      return res.status(500).json({ message: "Failed to add POC to gap" });
    }
  });

  // Remove a POC from a gap
  app.delete("/api/gaps/:id/pocs/:userId", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      const pocUserId = Number(req.params.userId);

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Check permissions: Admin, Management can remove any POC, users can remove themselves
      const canRemove = 
        ["Admin", "Management"].includes(user.role) || 
        user.id === pocUserId;

      if (!canRemove) {
        return res.status(403).json({ message: "Only Admin, Management can remove POCs, or users can remove themselves" });
      }

      const removed = await storage.removeGapPoc(gapId, pocUserId);
      if (!removed) {
        return res.status(404).json({ message: "POC assignment not found" });
      }

      // Log POC removal
      await storage.createAuditLog({
        userId: user.id,
        action: "gap_poc_removed",
        entityType: "gap",
        entityId: gapId,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Remove gap POC error:", error);
      return res.status(500).json({ message: "Failed to remove POC from gap" });
    }
  });

  app.post("/api/gaps/:id/reopen", requireAuth, async (req, res) => {
    try {
      // Verify gap exists and user has permission
      const existingGap = await storage.getGap(Number(req.params.id));
      if (!existingGap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only reporter, assignee, QA/Ops, Management, or Admin can reopen
      if (
        existingGap.reporterId !== user.id &&
        existingGap.assignedToId !== user.id &&
        !["QA/Ops", "Management", "Admin"].includes(user.role)
      ) {
        return res.status(403).json({ message: "Only the reporter, assignee, QA/Ops, or Management can reopen this gap" });
      }

      // Save current resolution to history if it exists
      if (existingGap.resolutionSummary && existingGap.resolvedAt) {
        await storage.createResolutionHistory({
          gapId: existingGap.id,
          resolutionSummary: existingGap.resolutionSummary,
          resolutionAttachments: existingGap.resolutionAttachments || [],
          resolvedById: existingGap.updatedById || existingGap.assignedToId || existingGap.reporterId,
          resolvedAt: existingGap.resolvedAt,
          reopenedById: req.session.userId!,
          reopenedAt: new Date(),
        });
      }

      // Clear resolution fields and update status to Reopened
      const gap = await storage.updateGap(Number(req.params.id), {
        status: "Reopened",
        reopenedAt: new Date(),
        reopenedById: req.session.userId!,
        resolutionSummary: null,
        resolutionAttachments: [],
        resolvedAt: null,
        updatedById: req.session.userId!,
      });

      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Log audit event
      await storage.createAuditLog({
        userId: user.id,
        action: "gap_reopened",
        entityType: "gap",
        entityId: gap.id,
        changes: { status: "Reopened", reopenedBy: user.name },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.json({ gap });
    } catch (error) {
      console.error("Reopen gap error:", error);
      return res.status(500).json({ message: "Failed to reopen gap" });
    }
  });

  app.get("/api/gaps/:id/resolution-history", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      
      // Verify gap exists
      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const history = await storage.getResolutionHistory(gapId);
      
      // Get resolver details for each history entry
      const detailedHistory = await Promise.all(
        history.map(async (entry) => {
          const resolver = await storage.getUser(entry.resolvedById);
          const reopener = entry.reopenedById ? await storage.getUser(entry.reopenedById) : null;
          return {
            ...entry,
            resolver: resolver ? { id: resolver.id, name: resolver.name, email: resolver.email } : null,
            reopener: reopener ? { id: reopener.id, name: reopener.name, email: reopener.email } : null,
          };
        })
      );

      return res.json({ history: detailedHistory });
    } catch (error) {
      console.error("Get resolution history error:", error);
      return res.status(500).json({ message: "Failed to get resolution history" });
    }
  });

  app.get("/api/gaps/:id/timeline", requireAuth, async (req, res) => {
    try {
      const gapId = Number(req.params.id);
      
      // Verify gap exists and user has access
      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Same access control as GET /api/gaps/:id
      const isAssignedPoc = await storage.isUserAssignedPoc(gapId, user.id);
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const timeline = await storage.getGapTimeline(gapId);
      return res.json({ timeline });
    } catch (error) {
      console.error("Get gap timeline error:", error);
      return res.status(500).json({ message: "Failed to get gap timeline" });
    }
  });

  app.get("/api/gaps/:id/similar", requireAuth, async (req, res) => {
    try {
      const similarGaps = await storage.getSimilarGaps(Number(req.params.id));
      
      // Get full gap details for similar gaps
      const detailedSimilarGaps = await Promise.all(
        similarGaps.map(async (sg) => {
          const gap = await storage.getGap(sg.similarGapId);
          return {
            ...sg,
            gap,
          };
        })
      );

      return res.json({ similarGaps: detailedSimilarGaps });
    } catch (error) {
      console.error("Get similar gaps error:", error);
      return res.status(500).json({ message: "Failed to get similar gaps" });
    }
  });

  // ==================== COMMENT ROUTES ====================
  
  app.get("/api/gaps/:gapId/comments", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getCommentsByGap(Number(req.params.gapId));
      
      // Get author info for each comment (sanitized)
      const detailedComments = await Promise.all(
        comments.map(async (comment) => {
          const author = await storage.getUser(comment.authorId);
          return {
            ...comment,
            author: author ? sanitizeUser(author) : null,
          };
        })
      );

      return res.json({ comments: detailedComments });
    } catch (error) {
      console.error("Get comments error:", error);
      return res.status(500).json({ message: "Failed to get comments" });
    }
  });

  app.post("/api/gaps/:gapId/comments", requireAuth, async (req, res) => {
    try {
      const { content, attachments } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      const gapId = Number(req.params.gapId);
      const gap = await storage.getGap(gapId);
      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Check user has access to this gap
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // RBAC: Same access control as GET /api/gaps/:id
      const isAssignedPoc = await storage.isUserAssignedPoc(gapId, user.id);
      if (user.role !== "Admin" && user.role !== "Management") {
        if (user.role === "QA/Ops" && gap.reporterId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only comment on gaps you reported" });
        }
        if (user.role === "POC" && gap.assignedToId !== user.id && !isAssignedPoc) {
          return res.status(403).json({ message: "Access denied: You can only comment on gaps assigned to you" });
        }
      }

      const comment = await storage.createComment({
        gapId,
        authorId: req.session.userId!,
        content,
        attachments: attachments || [],
      });

      const author = await storage.getUser(comment.authorId);
      const sanitizedAuthor = author ? sanitizeUser(author) : null;

      // Emit real-time comment via WebSocket to all POCs (sanitized)
      const io = (app as any).io as SocketIOServer;
      const commentEvent = {
        ...comment,
        author: sanitizedAuthor,
      };
      
      // Emit to all gap room subscribers
      io.to(`gap-${req.params.gapId}`).emit("new-comment", commentEvent);
      
      // Also emit to notification system for all POCs
      const pocs = await storage.getGapPocs(gapId);
      for (const poc of pocs) {
        io.to(`user-${poc.userId}`).emit("poc-comment-notification", {
          gapId,
          gapTitle: gap.title,
          commentAuthor: sanitizedAuthor?.name || "Unknown",
          comment: comment.content.substring(0, 100),
          timestamp: new Date(),
        });
      }

      return res.json({ comment: { ...comment, author: sanitizedAuthor } });
    } catch (error) {
      console.error("Create comment error:", error);
      return res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Resolve Gap
  app.patch("/api/gaps/:id/resolve", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only Admin, Management, and POC can resolve gaps
      if (!["Admin", "Management", "POC"].includes(user.role)) {
        return res.status(403).json({ message: "Only Admin, Management, and POC can resolve gaps" });
      }

      const { resolutionSummary, resolutionAttachments } = req.body;

      if (!resolutionSummary || !resolutionSummary.trim()) {
        return res.status(400).json({ message: "Resolution summary is required" });
      }

      const gap = await storage.resolveGap(
        Number(req.params.id),
        resolutionSummary,
        resolutionAttachments || [],
        req.session.userId
      );

      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Log audit event
      await storage.createAuditLog({
        userId: user.id,
        action: "gap_resolved",
        entityType: "gap",
        entityId: gap.id,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      // Send email notification to reporter with CC to all POCs
      const reporter = await storage.getUser(gap.reporterId);
      if (reporter && reporter.email) {
        // Fetch all POCs for this gap to CC them
        const pocs = await storage.getGapPocs(gap.id);
        const ccEmails = pocs
          .map(poc => poc.user?.email || "")
          .filter(email => email); // Remove empty emails
        
        await sendGapResolutionEmail(
          reporter.name,
          reporter.email,
          gap.gapId,
          gap.title,
          gap.id,
          reporter.role,
          ccEmails.length > 0 ? ccEmails : undefined
        ).catch(console.error);
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Resolve gap error:", error);
      return res.status(500).json({ message: "Failed to resolve gap" });
    }
  });

  // ==================== SOP ROUTES ====================
  
  app.get("/api/sops", requireAuth, async (req, res) => {
    try {
      const { department, active } = req.query;
      
      let sops;
      if (department) {
        sops = await storage.getSopsByDepartment(department as string);
      } else if (active === "true") {
        sops = await storage.getActiveSops();
      } else {
        sops = await storage.getAllSops();
      }

      return res.json({ sops });
    } catch (error) {
      console.error("Get SOPs error:", error);
      return res.status(500).json({ message: "Failed to get SOPs" });
    }
  });

  app.get("/api/sops/:id", requireAuth, async (req, res) => {
    try {
      const sop = await storage.getSop(Number(req.params.id));
      if (!sop) {
        return res.status(404).json({ message: "SOP not found" });
      }

      return res.json({ sop });
    } catch (error) {
      console.error("Get SOP error:", error);
      return res.status(500).json({ message: "Failed to get SOP" });
    }
  });

  app.post("/api/sops", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { title, description, content, category, department, version, parentSopId } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const sop = await storage.createSop({
        title,
        description: description || null,
        content,
        category: category || null,
        department: department || null,
        parentSopId: parentSopId || null,
        version: version || "1.0",
        createdById: req.session.userId!,
        updatedById: req.session.userId!,
        active: true,
      });

      return res.json({ sop });
    } catch (error) {
      console.error("Create SOP error:", error);
      return res.status(500).json({ message: "Failed to create SOP" });
    }
  });

  app.patch("/api/sops/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { title, description, content, category, department, version, parentSopId } = req.body;
      
      const updateData: any = {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(content && { content }),
        ...(category !== undefined && { category }),
        ...(department !== undefined && { department }),
        ...(version && { version }),
        ...(parentSopId !== undefined && { parentSopId }),
        updatedById: req.session.userId!,
      };

      const sop = await storage.updateSop(Number(req.params.id), updateData);
      if (!sop) {
        return res.status(404).json({ message: "SOP not found" });
      }

      return res.json({ sop });
    } catch (error) {
      console.error("Update SOP error:", error);
      return res.status(500).json({ message: "Failed to update SOP" });
    }
  });

  app.delete("/api/sops/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const deleted = await storage.deleteSop(Number(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "SOP not found" });
      }

      return res.json({ message: "SOP deleted successfully" });
    } catch (error) {
      console.error("Delete SOP error:", error);
      return res.status(500).json({ message: "Failed to delete SOP" });
    }
  });

  app.post("/api/sops/search", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || !query.trim()) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const sops = await storage.searchSops(query.trim());
      return res.json({ sops });
    } catch (error) {
      console.error("Search SOPs error:", error);
      return res.status(500).json({ message: "Failed to search SOPs" });
    }
  });

  app.post("/api/sops/ai-search", requireAuth, async (req, res) => {
    try {
      const { question } = req.body;

      if (!question || !question.trim()) {
        return res.status(400).json({ message: "Question is required" });
      }

      // Get all SOPs for RAG
      const allSops = await storage.getAllSops();
      
      if (allSops.length === 0) {
        return res.json({ 
          recommendations: [],
          reasoning: "No SOPs available in the system yet."
        });
      }

      // Use OpenRouter for AI-powered search
      const openrouterKey = process.env.OPENROUTER_API_KEY;
      console.log("[AI Search] OpenRouter Key available:", !!openrouterKey);
      
      if (!openrouterKey) {
        console.log("[AI Search] No OpenRouter key - using fallback");
        // Fallback to basic text search if no AI available
        const results = await storage.searchSops(question);
        const recommendations = results.slice(0, 3).map(sop => ({
          sopId: sop.sopId,
          title: sop.title,
          relevance: 60,
          content: sop.content,
          reasoning: "Based on keyword matching"
        }));
        return res.json({ 
          recommendations,
          reasoning: "Using basic search (AI not available)"
        });
      }

      // Create context for AI
      const sopContext = allSops
        .map(s => `SOP: ${s.sopId} - ${s.title}\nDescription: ${s.description}\nContent: ${s.content.substring(0, 200)}...`)
        .join("\n\n");

      const aiPrompt = `You are an expert at finding relevant Standard Operating Procedures (SOPs).

Available SOPs:
${sopContext}

User's Issue/Question: ${question}

Task: Identify the top 3 most relevant SOPs for this issue. For each SOP, provide:
1. The SOP ID and Title
2. A relevance score (0-100)
3. Brief reasoning for why this SOP is relevant
4. The most relevant section from the SOP

Format your response as JSON:
{
  "recommendations": [
    {
      "sopId": "SOP-001",
      "title": "SOP Title",
      "relevance": 95,
      "content": "Most relevant section",
      "reasoning": "Why this is relevant"
    }
  ],
  "reasoning": "Overall analysis of the issue"
}`;

      console.log("[AI Search] Calling OpenRouter API...");
      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://solvextra.com",
        },
        body: JSON.stringify({
          model: "gpt-4-turbo",
          messages: [
            { role: "user", content: aiPrompt }
          ],
          temperature: 0.7,
        }),
      });

      console.log("[AI Search] OpenRouter response status:", aiResponse.status);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("[AI Search] OpenRouter error response:", errorText);
        // Fallback to basic search
        const results = await storage.searchSops(question);
        const recommendations = results.slice(0, 3).map(sop => ({
          sopId: sop.sopId,
          title: sop.title,
          relevance: 60,
          content: sop.content,
          reasoning: "Based on text search"
        }));
        return res.json({ 
          recommendations,
          reasoning: "Using text-based search (AI unavailable)"
        });
      }

      const aiData = await aiResponse.json();
      console.log("[AI Search] OpenRouter response received");
      
      const aiContent = aiData.choices?.[0]?.message?.content;
      
      if (!aiContent) {
        console.error("[AI Search] No content in AI response:", aiData);
        throw new Error("Invalid AI response");
      }

      // Parse AI response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      const parsedResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (!parsedResponse || !Array.isArray(parsedResponse.recommendations)) {
        console.error("[AI Search] Could not parse AI response:", aiContent);
        throw new Error("Could not parse AI response");
      }

      console.log("[AI Search] Successfully parsed recommendations:", parsedResponse.recommendations.length);
      return res.json({
        recommendations: parsedResponse.recommendations,
        reasoning: parsedResponse.reasoning || "AI analysis"
      });
    } catch (error) {
      console.error("AI SOP search error:", error);
      return res.status(500).json({ message: "Failed to search SOPs with AI" });
    }
  });

  // ==================== FORM TEMPLATE ROUTES ====================
  
  // All authenticated users can view templates
  app.get("/api/form-templates", requireAuth, async (req, res) => {
    try {
      const { active } = req.query;
      
      const templates = active === "true" 
        ? await storage.getActiveFormTemplates()
        : await storage.getAllFormTemplates();

      return res.json({ templates });
    } catch (error) {
      console.error("Get form templates error:", error);
      return res.status(500).json({ message: "Failed to get form templates" });
    }
  });

  // All authenticated users can view a specific template
  app.get("/api/form-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getFormTemplate(Number(req.params.id));
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      return res.json({ template });
    } catch (error) {
      console.error("Get form template error:", error);
      return res.status(500).json({ message: "Failed to get form template" });
    }
  });

  // Only Admin and Management can create templates
  app.post("/api/form-templates", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { name, description, schemaJson, visibility, department, version } = req.body;

      if (!name || !schemaJson) {
        return res.status(400).json({ message: "Name and schema are required" });
      }

      const template = await storage.createFormTemplate({
        name,
        description: description || null,
        schemaJson,
        visibility: visibility || "all",
        department: department || null,
        version: version || "1.0",
        createdById: req.session.userId!,
        active: true,
      });

      return res.json({ template });
    } catch (error) {
      console.error("Create form template error:", error);
      return res.status(500).json({ message: "Failed to create form template" });
    }
  });

  // Only Admin and Management can update templates
  app.patch("/api/form-templates/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { name, description, schemaJson, visibility, department, version, active } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (schemaJson !== undefined) updates.schemaJson = schemaJson;
      if (visibility !== undefined) updates.visibility = visibility;
      if (department !== undefined) updates.department = department;
      if (version !== undefined) updates.version = version;
      if (active !== undefined) updates.active = active;

      const template = await storage.updateFormTemplate(Number(req.params.id), updates);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      return res.json({ template });
    } catch (error) {
      console.error("Update form template error:", error);
      return res.status(500).json({ message: "Failed to update form template" });
    }
  });

  // Only Admin and Management can delete templates
  app.delete("/api/form-templates/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      await storage.deleteFormTemplate(Number(req.params.id));
      return res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error("Delete form template error:", error);
      return res.status(500).json({ message: "Failed to delete form template" });
    }
  });

  // Only Admin and Management can duplicate templates
  app.post("/api/form-templates/:id/duplicate", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Name is required for duplicate" });
      }

      const template = await storage.duplicateFormTemplate(
        Number(req.params.id),
        name,
        req.session.userId!
      );

      return res.json({ template });
    } catch (error) {
      console.error("Duplicate form template error:", error);
      return res.status(500).json({ message: "Failed to duplicate template" });
    }
  });

  // ==================== TAT EXTENSION ROUTES ====================
  
  app.get("/api/tat-extensions/pending", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const extensions = await storage.getPendingExtensions();
      
      const detailedExtensions = await Promise.all(
        extensions.map(async (ext) => {
          const gap = await storage.getGap(ext.gapId);
          const requestedBy = await storage.getUser(ext.requestedById);
          return { ...ext, gap, requestedBy };
        })
      );

      return res.json({ extensions: detailedExtensions });
    } catch (error) {
      console.error("Get pending extensions error:", error);
      return res.status(500).json({ message: "Failed to get extensions" });
    }
  });

  app.post("/api/gaps/:gapId/tat-extensions", requireAuth, async (req, res) => {
    try {
      const { reason, requestedDeadline } = req.body;

      if (!reason || !requestedDeadline) {
        return res.status(400).json({ message: "Reason and requested deadline are required" });
      }

      const extension = await storage.createTatExtension({
        gapId: Number(req.params.gapId),
        requestedById: req.session.userId!,
        reason,
        requestedDeadline: new Date(requestedDeadline),
        status: "Pending",
        reviewedById: null,
        reviewedAt: null,
      });

      // Send email notification to management
      const gap = await storage.getGap(Number(req.params.gapId));
      const requester = await storage.getUser(req.session.userId!);
      if (gap && requester) {
        // Get all management/admin users
        const managers = await storage.getUsersByRole("Management");
        const admins = await storage.getUsersByRole("Admin");
        const allManagers = [...managers, ...admins];
        
        // Send to all managers/admins
        for (const manager of allManagers) {
          await sendTATExtensionRequestEmail(
            manager.name,
            manager.email,
            gap.gapId,
            gap.title,
            requester.name,
            reason,
            new Date(requestedDeadline)
          );
        }
      }

      return res.json({ extension });
    } catch (error) {
      console.error("Create TAT extension error:", error);
      return res.status(500).json({ message: "Failed to create extension" });
    }
  });

  app.patch("/api/tat-extensions/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { status } = req.body;

      if (!status || !["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const extension = await storage.updateTatExtension(Number(req.params.id), {
        status,
        reviewedById: req.session.userId!,
        reviewedAt: new Date(),
      });

      if (!extension) {
        return res.status(404).json({ message: "Extension not found" });
      }

      // Update gap TAT deadline if approved
      if (status === "Approved") {
        await storage.updateGap(extension.gapId, {
          tatDeadline: extension.requestedDeadline,
        });
      }

      return res.json({ extension });
    } catch (error) {
      console.error("Update TAT extension error:", error);
      return res.status(500).json({ message: "Failed to update extension" });
    }
  });

  // ==================== POC PERFORMANCE ROUTES ====================
  
  app.get("/api/poc-performance", requireRole("Admin"), async (req, res) => {
    try {
      const performanceData = await storage.getPocPerformanceMetrics();
      return res.json({ performance: performanceData });
    } catch (error) {
      console.error("Get POC performance error:", error);
      return res.status(500).json({ message: "Failed to get POC performance" });
    }
  });

  app.get("/api/poc-performance/me", requireRole("POC"), async (req, res) => {
    try {
      const performanceData = await storage.getPocPerformanceMetrics(req.session.userId!);
      return res.json({ performance: performanceData[0] || null });
    } catch (error) {
      console.error("Get my performance error:", error);
      return res.status(500).json({ message: "Failed to get performance" });
    }
  });

  // ==================== AUDIT LOG ROUTES ====================
  
  app.get("/api/audit-logs", requireRole("Admin"), async (req, res) => {
    try {
      const { limit = 100, userId, entityType, entityId } = req.query;
      
      let logs;
      
      if (userId) {
        logs = await storage.getAuditLogsByUser(Number(userId), Number(limit));
      } else if (entityType && entityId) {
        logs = await storage.getAuditLogsByEntity(
          entityType as string, 
          Number(entityId), 
          Number(limit)
        );
      } else {
        logs = await storage.getAuditLogs(Number(limit));
      }
      
      // Enrich with user information
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const user = log.userId ? await storage.getUser(log.userId) : null;
        return {
          ...log,
          user: user ? sanitizeUser(user) : null,
        };
      }));
      
      return res.json({ logs: enrichedLogs });
    } catch (error) {
      console.error("Get audit logs error:", error);
      return res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  // ==================== ADMIN SETTINGS ====================
  
  app.get("/api/admin/settings", requireRole("Admin"), async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const settingsPath = path.join(process.cwd(), "settings.json");
      
      try {
        const data = await fs.readFile(settingsPath, "utf-8");
        const settings = JSON.parse(data);
        return res.json({ settings });
      } catch (error) {
        // Return default settings if file doesn't exist
        return res.json({
          settings: {
            openrouterModel: process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5",
          }
        });
      }
    } catch (error) {
      console.error("Get settings error:", error);
      return res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.patch("/api/admin/settings", requireRole("Admin"), async (req, res) => {
    try {
      const { openrouterModel } = req.body;
      
      if (!openrouterModel) {
        return res.status(400).json({ message: "OpenRouter model is required" });
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const settingsPath = path.join(process.cwd(), "settings.json");
      
      const settings = {
        openrouterModel,
        updatedAt: new Date().toISOString(),
        updatedBy: req.session.userId,
      };

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      
      // Update environment variable for immediate effect
      process.env.OPENROUTER_MODEL = openrouterModel;
      
      return res.json({ settings });
    } catch (error) {
      console.error("Update settings error:", error);
      return res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // ==================== DASHBOARD METRICS ====================
  
  app.get("/api/dashboard/metrics", requireAuth, async (req, res) => {
    try {
      const allGaps = await storage.getAllGaps();
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const metrics: any = {
        totalGaps: allGaps.length,
        pendingReview: allGaps.filter(g => g.status === "NeedsReview").length,
        overdue: allGaps.filter(g => {
          if (!g.tatDeadline) return false;
          return new Date(g.tatDeadline) < now && !["Resolved", "Closed"].includes(g.status);
        }).length,
        resolvedThisWeek: allGaps.filter(g => 
          g.resolvedAt && new Date(g.resolvedAt) > oneWeekAgo
        ).length,
      };

      if (user.role === "QA/Ops") {
        const myGaps = allGaps.filter(g => g.reporterId === userId);
        metrics.totalRaised = myGaps.length;
        metrics.validated = myGaps.filter(g => g.status !== "PendingAI").length;
      } else if (user.role === "POC") {
        const assignedGaps = allGaps.filter(g => g.assignedToId === userId);
        metrics.assignedGaps = assignedGaps.length;
        metrics.closedGaps = allGaps.filter(g => 
          g.assignedToId === userId && g.status === "Closed"
        ).length;
        metrics.tatBreaches = assignedGaps.filter(g => {
          if (!g.tatDeadline) return false;
          return new Date(g.tatDeadline) < now && !["Resolved", "Closed"].includes(g.status);
        }).length;
      }

      return res.json({ metrics });
    } catch (error) {
      console.error("Get dashboard metrics error:", error);
      return res.status(500).json({ message: "Failed to get metrics" });
    }
  });

  // ==================== REPORTS ====================
  
  // Get filtered gaps for reports with RBAC
  app.get("/api/reports/gaps", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse filters from query params
      const filters: any = {};
      
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo as string);
      if (req.query.templateIds) filters.templateIds = (req.query.templateIds as string).split(',').map(Number);
      if (req.query.statuses) filters.statuses = (req.query.statuses as string).split(',');
      if (req.query.departments) filters.departments = (req.query.departments as string).split(',');
      if (req.query.userIds) filters.userIds = (req.query.userIds as string).split(',').map(Number);
      if (req.query.roles) filters.roles = (req.query.roles as string).split(',');
      if (req.query.employeeIds) filters.employeeIds = (req.query.employeeIds as string).split(',');
      if (req.query.emails) filters.emails = (req.query.emails as string).split(',');

      // Get filtered gaps
      let gaps = await storage.getFilteredGaps(filters);

      // Apply RBAC filtering
      if (user.role === "QA/Ops") {
        // QA/Ops can only see gaps they reported
        gaps = gaps.filter(g => g.reporterId === user.id);
      } else if (user.role === "POC") {
        // POC can only see gaps assigned to them
        const pocGapIds = new Set<number>();
        
        // Get gaps where user is primary assignee
        const assignedGaps = gaps.filter(g => g.assignedToId === user.id);
        assignedGaps.forEach(g => pocGapIds.add(g.id));
        
        // Get gaps where user is in POC list
        for (const gap of gaps) {
          const pocs = await storage.getGapPocs(gap.id);
          if (pocs.some(p => p.userId === user.id)) {
            pocGapIds.add(gap.id);
          }
        }
        
        gaps = gaps.filter(g => pocGapIds.has(g.id));
      }
      // Admin and Management can see all gaps

      // Enrich gaps with user and template info
      const enrichedGaps: GapWithRelations[] = await Promise.all(
        gaps.map(async (gap) => {
          const reporter = gap.reporterId ? await storage.getUser(gap.reporterId) : undefined;
          const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : undefined;
          const template = gap.formTemplateId ? await storage.getFormTemplate(gap.formTemplateId) : undefined;
          const closedBy = gap.closedById ? await storage.getUser(gap.closedById) : undefined;
          const updatedBy = gap.updatedById ? await storage.getUser(gap.updatedById) : undefined;
          const reopenedBy = gap.reopenedById ? await storage.getUser(gap.reopenedById) : undefined;
          const pocs = await storage.getGapPocsWithDetails(gap.id);

          return {
            ...gap,
            reporter,
            assignee,
            template,
            closedBy,
            updatedBy,
            reopenedBy,
            pocs: pocs.map(p => ({
              user: p.user,
              addedBy: p.addedBy,
              addedAt: p.addedAt,
              isPrimary: p.isPrimary
            }))
          };
        })
      );

      return res.json({ gaps: enrichedGaps, total: enrichedGaps.length });
    } catch (error) {
      console.error("Get reports error:", error);
      return res.status(500).json({ message: "Failed to get reports" });
    }
  });

  // Export gaps to Excel with RBAC
  app.get("/api/reports/export", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Parse filters (same as above)
      const filters: any = {};
      
      if (req.query.dateFrom) filters.dateFrom = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filters.dateTo = new Date(req.query.dateTo as string);
      if (req.query.templateIds) filters.templateIds = (req.query.templateIds as string).split(',').map(Number);
      if (req.query.statuses) filters.statuses = (req.query.statuses as string).split(',');
      if (req.query.departments) filters.departments = (req.query.departments as string).split(',');
      if (req.query.userIds) filters.userIds = (req.query.userIds as string).split(',').map(Number);
      if (req.query.roles) filters.roles = (req.query.roles as string).split(',');
      if (req.query.employeeIds) filters.employeeIds = (req.query.employeeIds as string).split(',');
      if (req.query.emails) filters.emails = (req.query.emails as string).split(',');

      const templateId = req.query.templateId ? Number(req.query.templateId) : undefined;

      // Get filtered gaps
      let gaps = await storage.getFilteredGaps(filters);

      // Apply RBAC filtering
      if (user.role === "QA/Ops") {
        gaps = gaps.filter(g => g.reporterId === user.id);
      } else if (user.role === "POC") {
        const pocGapIds = new Set<number>();
        
        const assignedGaps = gaps.filter(g => g.assignedToId === user.id);
        assignedGaps.forEach(g => pocGapIds.add(g.id));
        
        for (const gap of gaps) {
          const pocs = await storage.getGapPocs(gap.id);
          if (pocs.some(p => p.userId === user.id)) {
            pocGapIds.add(gap.id);
          }
        }
        
        gaps = gaps.filter(g => pocGapIds.has(g.id));
      }

      // Enrich gaps with relations
      const enrichedGaps: GapWithRelations[] = await Promise.all(
        gaps.map(async (gap) => {
          const reporter = gap.reporterId ? await storage.getUser(gap.reporterId) : undefined;
          const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : undefined;
          const template = gap.formTemplateId ? await storage.getFormTemplate(gap.formTemplateId) : undefined;
          const closedBy = gap.closedById ? await storage.getUser(gap.closedById) : undefined;
          const updatedBy = gap.updatedById ? await storage.getUser(gap.updatedById) : undefined;
          const reopenedBy = gap.reopenedById ? await storage.getUser(gap.reopenedById) : undefined;
          const pocs = await storage.getGapPocsWithDetails(gap.id);

          return {
            ...gap,
            reporter,
            assignee,
            template,
            closedBy,
            updatedBy,
            reopenedBy,
            pocs: pocs.map(p => ({
              user: p.user,
              addedBy: p.addedBy,
              addedAt: p.addedAt,
              isPrimary: p.isPrimary
            }))
          };
        })
      );

      // Get template if specified
      const template = templateId ? await storage.getFormTemplate(templateId) : undefined;

      // Generate Excel file
      const excelBuffer = generateExcelReport(enrichedGaps, template);

      // Set headers for file download
      const filename = template
        ? `${template.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.xlsx`
        : `GapOps_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(excelBuffer);
    } catch (error) {
      console.error("Export reports error:", error);
      return res.status(500).json({ message: "Failed to export reports" });
    }
  });

  return httpServer;
}
