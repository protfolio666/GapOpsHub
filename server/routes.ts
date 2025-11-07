import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { authenticateUser, createUser, hashPassword, requireAuth, requireRole, attachUser, sanitizeUser } from "./auth";
import { findSimilarGapsWithAI, suggestSOPsWithAI } from "./openrouter-ai";
import { sendGapAssignmentEmail, sendGapResolutionEmail, sendTATExtensionRequestEmail } from "./email-service";
import { logGapCreation, logGapAssignment, logGapStatusChange, logUserLogin, logUserLogout } from "./audit-logger";
import type { Gap } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";

// Validation schemas
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(["Admin", "Management", "QA/Ops", "POC"]).optional(),
  department: z.string().nullable().optional(),
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

        // Allow if user is: reporter, assignee, or Management/Admin/QA
        const hasAccess =
          gap.reporterId === user.id ||
          gap.assignedToId === user.id ||
          ["Management", "Admin", "QA/Ops"].includes(user.role);

        if (!hasAccess) {
          socket.emit("error", { message: "Access denied to this gap" });
          return;
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

      const { email, name, role, department, password } = validation.data;

      const updates: Partial<{
        email: string;
        name: string;
        role: string;
        department: string | null;
        passwordHash: string;
      }> = {};

      if (email !== undefined) updates.email = email;
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (department !== undefined) updates.department = department;
      if (password !== undefined) {
        const passwordHash = await bcrypt.hash(password, 10);
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
        // POC: Only see gaps assigned to them
        gaps = await storage.getGapsByAssignee(user.id);
        if (status) {
          gaps = gaps.filter(g => g.status === status);
        }
      } else {
        gaps = [];
      }

      return res.json({ gaps });
    } catch (error) {
      console.error("Get gaps error:", error);
      return res.status(500).json({ message: "Failed to get gaps" });
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
        if (user.role === "POC" && gap.assignedToId !== user.id) {
          return res.status(403).json({ message: "Access denied: You can only view gaps assigned to you" });
        }
      }

      // Get reporter and assignee info (sanitized)
      const reporter = await storage.getUser(gap.reporterId);
      const assignee = gap.assignedToId ? await storage.getUser(gap.assignedToId) : null;

      return res.json({ 
        gap,
        reporter: reporter ? sanitizeUser(reporter) : null,
        assignee: assignee ? sanitizeUser(assignee) : null
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

      // Calculate similarity with existing gaps using OpenRouter AI
      // Run asynchronously to not block response
      setImmediate(async () => {
        try {
          const allGaps = await storage.getAllGaps();
          const otherGaps = allGaps.filter(g => g.id !== gap.id && g.status !== "Closed");
          const similarGaps = await findSimilarGapsWithAI(gap, otherGaps, 60);
          
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

          await storage.updateGap(gap.id, { 
            aiProcessed: true,
            status: "NeedsReview" 
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
      
      const gap = await storage.updateGap(Number(req.params.id), req.body);
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
      const { assignedToId, tatDeadline, notes } = req.body;

      if (!assignedToId) {
        return res.status(400).json({ message: "Assignee is required" });
      }

      // Verify gap exists and user has permission
      const existingGap = await storage.getGap(Number(req.params.id));
      if (!existingGap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const gap = await storage.updateGap(Number(req.params.id), {
        assignedToId,
        tatDeadline: tatDeadline ? new Date(tatDeadline) : null,
        status: "Assigned",
      });

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

      // Send email notification to assignee
      const assignee = await storage.getUser(assignedToId);
      if (assignee) {
        await sendGapAssignmentEmail(
          assignee.name,
          assignee.email,
          gap.gapId,
          gap.title,
          gap.priority,
          gap.tatDeadline || undefined
        );
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Assign gap error:", error);
      return res.status(500).json({ message: "Failed to assign gap" });
    }
  });

  app.post("/api/gaps/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { resolutionSummary } = req.body;

      // Verify gap exists and user is assignee or has management role
      const existingGap = await storage.getGap(Number(req.params.id));
      if (!existingGap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only assignee or Management/Admin can resolve
      if (existingGap.assignedToId !== user.id && !["Management", "Admin"].includes(user.role)) {
        return res.status(403).json({ message: "Only the assigned POC or Management can resolve this gap" });
      }

      const gap = await storage.updateGap(Number(req.params.id), {
        status: "Resolved",
        resolvedAt: new Date(),
      });

      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      // Add resolution as a comment
      if (resolutionSummary && req.session.userId) {
        await storage.createComment({
          gapId: gap.id,
          authorId: req.session.userId,
          content: `**Resolution:** ${resolutionSummary}`,
          attachments: [],
        });
      }

      // Log status change
      await logGapStatusChange(req.session.userId!, gap.id, existingGap.status, "Resolved", req);

      // Send email notification to reporter
      const reporter = await storage.getUser(gap.reporterId);
      if (reporter) {
        await sendGapResolutionEmail(
          reporter.name,
          reporter.email,
          gap.gapId,
          gap.title
        );
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Resolve gap error:", error);
      return res.status(500).json({ message: "Failed to resolve gap" });
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

      // Only reporter, assignee, or Management/Admin can reopen
      if (
        existingGap.reporterId !== user.id &&
        existingGap.assignedToId !== user.id &&
        !["Management", "Admin"].includes(user.role)
      ) {
        return res.status(403).json({ message: "Only the reporter, assignee, or Management can reopen this gap" });
      }

      const gap = await storage.updateGap(Number(req.params.id), {
        status: "Reopened",
        reopenedAt: new Date(),
      });

      if (!gap) {
        return res.status(404).json({ message: "Gap not found" });
      }

      return res.json({ gap });
    } catch (error) {
      console.error("Reopen gap error:", error);
      return res.status(500).json({ message: "Failed to reopen gap" });
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

      const comment = await storage.createComment({
        gapId: Number(req.params.gapId),
        authorId: req.session.userId!,
        content,
        attachments: attachments || [],
      });

      const author = await storage.getUser(comment.authorId);
      const sanitizedAuthor = author ? sanitizeUser(author) : null;

      // Emit real-time comment via WebSocket (sanitized)
      const io = (app as any).io as SocketIOServer;
      io.to(`gap-${req.params.gapId}`).emit("new-comment", {
        ...comment,
        author: sanitizedAuthor,
      });

      return res.json({ comment: { ...comment, author: sanitizedAuthor } });
    } catch (error) {
      console.error("Create comment error:", error);
      return res.status(500).json({ message: "Failed to create comment" });
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
      const { title, description, content, category, department, version } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      const sop = await storage.createSop({
        title,
        description: description || null,
        content,
        category: category || null,
        department: department || null,
        version: version || "1.0",
        createdById: req.session.userId!,
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
      const sop = await storage.updateSop(Number(req.params.id), req.body);
      if (!sop) {
        return res.status(404).json({ message: "SOP not found" });
      }

      return res.json({ sop });
    } catch (error) {
      console.error("Update SOP error:", error);
      return res.status(500).json({ message: "Failed to update SOP" });
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
            openrouterModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
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

  return httpServer;
}
