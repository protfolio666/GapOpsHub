import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { authenticateUser, createUser, hashPassword, requireAuth, requireRole, attachUser, sanitizeUser } from "./auth";
import { calculateSimilarity, findSimilarGaps } from "./ai-similarity";
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
      
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Registration endpoint for creating new users (Admin only)
  app.post("/api/auth/register", requireRole("Admin"), async (req, res) => {
    try {
      const { email, name, password, role } = req.body;
      
      if (!email || !password || !name || !role) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Verify user doesn't already exist
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Validate role
      const validRoles = ["Admin", "Management", "QA/Ops", "POC"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await createUser(email, name, password, role);
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
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
      let gaps;

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
      const { title, description, department, priority, severity, attachments } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      const gap = await storage.createGap({
        title,
        description,
        department: department || null,
        priority: priority || "Medium",
        severity: severity || null,
        reporterId: req.session.userId!,
        assignedToId: null,
        tatDeadline: null,
        resolvedAt: null,
        closedAt: null,
        reopenedAt: null,
        status: "PendingAI",
        aiProcessed: false,
        attachments: attachments || [],
      });

      // Calculate similarity with existing gaps (AI processing)
      // Run asynchronously to not block response
      setImmediate(async () => {
        try {
          const allGaps = await storage.getAllGaps();
          const similarGaps = await findSimilarGaps(gap, allGaps);
          
          for (const similar of similarGaps) {
            // Store bidirectional similarity for better lookup
            await storage.createSimilarGap({
              gapId: gap.id,
              similarGapId: similar.gapId,
              similarityScore: similar.score,
            });
            // Also store reverse relationship
            await storage.createSimilarGap({
              gapId: similar.gapId,
              similarGapId: gap.id,
              similarityScore: similar.score,
            });
          }

          await storage.updateGap(gap.id, { 
            aiProcessed: true,
            status: "NeedsReview" 
          });
        } catch (error) {
          console.error("AI processing error:", error);
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
            const similarGaps = await findSimilarGaps(gap, allGaps);
            
            for (const similar of similarGaps) {
              await storage.createSimilarGap({
                gapId: gap.id,
                similarGapId: similar.gapId,
                similarityScore: similar.score,
              });
              // Also store reverse relationship
              await storage.createSimilarGap({
                gapId: similar.gapId,
                similarGapId: gap.id,
                similarityScore: similar.score,
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
  
  app.get("/api/form-templates", requireRole("Management", "Admin"), async (req, res) => {
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

  app.get("/api/form-templates/:id", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const template = await storage.getFormTemplate(Number(req.params.id));
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const fields = await storage.getFormFieldsByTemplate(template.id);

      return res.json({ template, fields });
    } catch (error) {
      console.error("Get form template error:", error);
      return res.status(500).json({ message: "Failed to get form template" });
    }
  });

  app.post("/api/form-templates", requireRole("Management", "Admin"), async (req, res) => {
    try {
      const { name, description, department, fields } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const template = await storage.createFormTemplate({
        name,
        description: description || null,
        department: department || null,
        createdById: req.session.userId!,
        active: true,
      });

      // Create fields
      if (fields && Array.isArray(fields)) {
        for (let i = 0; i < fields.length; i++) {
          await storage.createFormField({
            templateId: template.id,
            fieldType: fields[i].type,
            label: fields[i].label,
            required: fields[i].required || false,
            options: fields[i].options || null,
            order: i,
          });
        }
      }

      const createdFields = await storage.getFormFieldsByTemplate(template.id);

      return res.json({ template, fields: createdFields });
    } catch (error) {
      console.error("Create form template error:", error);
      return res.status(500).json({ message: "Failed to create form template" });
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
