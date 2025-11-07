import { db } from "./db";
import { 
  users, gaps, comments, sops, formTemplates, formFields, 
  gapAssignments, tatExtensions, similarGaps, auditLogs,
  type User, type InsertUser, type Gap, type InsertGap,
  type Comment, type InsertComment, type Sop, type InsertSop,
  type FormTemplate, type InsertFormTemplate, type FormField, type InsertFormField,
  type GapAssignment, type InsertGapAssignment, type TatExtension, type InsertTatExtension,
  type SimilarGap, type InsertSimilarGap, type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { eq, desc, and, sql, or } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByEmployeeId(employeeId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<boolean>;

  // Gap operations
  getGap(id: number): Promise<Gap | undefined>;
  getGapByGapId(gapId: string): Promise<Gap | undefined>;
  getAllGaps(): Promise<Gap[]>;
  getGapsByStatus(status: string): Promise<Gap[]>;
  getGapsByReporter(reporterId: number): Promise<Gap[]>;
  getGapsByAssignee(assignedToId: number): Promise<Gap[]>;
  createGap(gap: InsertGap): Promise<Gap>;
  updateGap(id: number, gap: Partial<Omit<Gap, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Gap | undefined>;
  deleteGap(id: number): Promise<boolean>;
  resolveGap(id: number, resolutionSummary: string, resolutionAttachments: any[]): Promise<Gap | undefined>;
  
  // Comment operations
  getComment(id: number): Promise<Comment | undefined>;
  getCommentsByGap(gapId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: number): Promise<boolean>;

  // SOP operations
  getSop(id: number): Promise<Sop | undefined>;
  getSopBySopId(sopId: string): Promise<Sop | undefined>;
  getAllSops(): Promise<Sop[]>;
  getActiveSops(): Promise<Sop[]>;
  getSopsByDepartment(department: string): Promise<Sop[]>;
  createSop(sop: InsertSop): Promise<Sop>;
  updateSop(id: number, sop: Partial<InsertSop>): Promise<Sop | undefined>;
  
  // Form Template operations
  getFormTemplate(id: number): Promise<FormTemplate | undefined>;
  getAllFormTemplates(): Promise<FormTemplate[]>;
  getActiveFormTemplates(): Promise<FormTemplate[]>;
  createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate>;
  updateFormTemplate(id: number, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined>;
  deleteFormTemplate(id: number): Promise<boolean>;
  duplicateFormTemplate(id: number, newName: string, userId: number): Promise<FormTemplate>;
  
  // Form Field operations
  getFormFieldsByTemplate(templateId: number): Promise<FormField[]>;
  createFormField(field: InsertFormField): Promise<FormField>;
  updateFormField(id: number, field: Partial<InsertFormField>): Promise<FormField | undefined>;
  deleteFormField(id: number): Promise<boolean>;
  
  // Gap Assignment operations
  getAssignmentsByGap(gapId: number): Promise<GapAssignment[]>;
  createGapAssignment(assignment: InsertGapAssignment): Promise<GapAssignment>;
  
  // TAT Extension operations
  getExtensionsByGap(gapId: number): Promise<TatExtension[]>;
  getPendingExtensions(): Promise<TatExtension[]>;
  createTatExtension(extension: InsertTatExtension): Promise<TatExtension>;
  updateTatExtension(id: number, extension: Partial<InsertTatExtension>): Promise<TatExtension | undefined>;
  
  // Similar Gap operations
  getSimilarGaps(gapId: number, minScore?: number): Promise<SimilarGap[]>;
  createSimilarGap(similarGap: InsertSimilarGap): Promise<SimilarGap>;
  deleteSimilarGapsByGapId(gapId: number): Promise<boolean>;
  
  // Audit Log operations
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: number, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: number, limit?: number): Promise<AuditLog[]>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user;
  }

  async createUser(user: Omit<InsertUser, 'passwordHash'> & { passwordHash: string }): Promise<User> {
    const [newUser] = await db.insert(users).values(user as any).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id));
    return true;
  }

  // Gap operations
  async getGap(id: number): Promise<Gap | undefined> {
    const [gap] = await db.select().from(gaps).where(eq(gaps.id, id));
    return gap;
  }

  async getGapByGapId(gapId: string): Promise<Gap | undefined> {
    const [gap] = await db.select().from(gaps).where(eq(gaps.gapId, gapId));
    return gap;
  }

  async getAllGaps(): Promise<Gap[]> {
    return await db.select().from(gaps).orderBy(desc(gaps.createdAt));
  }

  async getGapsByStatus(status: string): Promise<Gap[]> {
    return await db.select().from(gaps).where(eq(gaps.status, status)).orderBy(desc(gaps.createdAt));
  }

  async getGapsByReporter(reporterId: number): Promise<Gap[]> {
    return await db.select().from(gaps).where(eq(gaps.reporterId, reporterId)).orderBy(desc(gaps.createdAt));
  }

  async getGapsByAssignee(assignedToId: number): Promise<Gap[]> {
    return await db.select().from(gaps).where(eq(gaps.assignedToId, assignedToId)).orderBy(desc(gaps.createdAt));
  }

  async createGap(gap: InsertGap): Promise<Gap> {
    // Generate gap ID
    const count = await db.select({ count: sql<number>`count(*)` }).from(gaps);
    const gapNumber = (Number(count[0].count) + 1).toString().padStart(4, '0');
    const gapId = `GAP-${gapNumber}`;
    
    const [newGap] = await db.insert(gaps).values({ ...gap, gapId }).returning();
    return newGap;
  }

  async updateGap(id: number, gap: Partial<Omit<Gap, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Gap | undefined> {
    const [updatedGap] = await db
      .update(gaps)
      .set({ ...gap, updatedAt: new Date() })
      .where(eq(gaps.id, id))
      .returning();
    return updatedGap;
  }

  async deleteGap(id: number): Promise<boolean> {
    const result = await db.delete(gaps).where(eq(gaps.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async resolveGap(id: number, resolutionSummary: string, resolutionAttachments: string[]): Promise<Gap | undefined> {
    const [resolvedGap] = await db
      .update(gaps)
      .set({ 
        status: "Resolved",
        resolutionSummary,
        resolutionAttachments: resolutionAttachments as any,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(gaps.id, id))
      .returning();
    return resolvedGap;
  }

  // Comment operations
  async getComment(id: number): Promise<Comment | undefined> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    return comment;
  }

  async getCommentsByGap(gapId: number): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.gapId, gapId)).orderBy(comments.createdAt);
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db.insert(comments).values({
      ...comment,
      attachments: comment.attachments as any,
    } as any).returning();
    return newComment;
  }

  async deleteComment(id: number): Promise<boolean> {
    const result = await db.delete(comments).where(eq(comments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // SOP operations
  async getSop(id: number): Promise<Sop | undefined> {
    const [sop] = await db.select().from(sops).where(eq(sops.id, id));
    return sop;
  }

  async getSopBySopId(sopId: string): Promise<Sop | undefined> {
    const [sop] = await db.select().from(sops).where(eq(sops.sopId, sopId));
    return sop;
  }

  async getAllSops(): Promise<Sop[]> {
    return await db.select().from(sops).orderBy(desc(sops.createdAt));
  }

  async getActiveSops(): Promise<Sop[]> {
    return await db.select().from(sops).where(eq(sops.active, true)).orderBy(desc(sops.createdAt));
  }

  async getSopsByDepartment(department: string): Promise<Sop[]> {
    return await db.select().from(sops).where(eq(sops.department, department)).orderBy(desc(sops.createdAt));
  }

  async createSop(sop: InsertSop): Promise<Sop> {
    // Generate SOP ID
    const count = await db.select({ count: sql<number>`count(*)` }).from(sops);
    const sopNumber = (Number(count[0].count) + 1).toString().padStart(3, '0');
    const sopId = `SOP-${sopNumber}`;
    
    const [newSop] = await db.insert(sops).values({ ...sop, sopId }).returning();
    return newSop;
  }

  async updateSop(id: number, sop: Partial<InsertSop>): Promise<Sop | undefined> {
    const [updatedSop] = await db
      .update(sops)
      .set({ ...sop, updatedAt: new Date() })
      .where(eq(sops.id, id))
      .returning();
    return updatedSop;
  }

  // Form Template operations
  async getFormTemplate(id: number): Promise<FormTemplate | undefined> {
    const [template] = await db.select().from(formTemplates).where(eq(formTemplates.id, id));
    return template;
  }

  async getAllFormTemplates(): Promise<FormTemplate[]> {
    return await db.select().from(formTemplates).orderBy(desc(formTemplates.createdAt));
  }

  async getActiveFormTemplates(): Promise<FormTemplate[]> {
    return await db.select().from(formTemplates).where(eq(formTemplates.active, true)).orderBy(desc(formTemplates.createdAt));
  }

  async createFormTemplate(template: InsertFormTemplate): Promise<FormTemplate> {
    const [newTemplate] = await db.insert(formTemplates).values(template).returning();
    return newTemplate;
  }

  async updateFormTemplate(id: number, template: Partial<InsertFormTemplate>): Promise<FormTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(formTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(formTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteFormTemplate(id: number): Promise<boolean> {
    await db.delete(formTemplates).where(eq(formTemplates.id, id));
    return true;
  }

  async duplicateFormTemplate(id: number, newName: string, userId: number): Promise<FormTemplate> {
    const original = await this.getFormTemplate(id);
    if (!original) {
      throw new Error("Template not found");
    }

    const duplicate: InsertFormTemplate = {
      name: newName,
      description: original.description,
      schemaJson: original.schemaJson as any,
      visibility: original.visibility,
      department: original.department,
      version: "1.0",
      createdById: userId,
      active: original.active,
    };

    const [newTemplate] = await db.insert(formTemplates).values(duplicate as any).returning();
    return newTemplate;
  }

  // Form Field operations
  async getFormFieldsByTemplate(templateId: number): Promise<FormField[]> {
    return await db.select().from(formFields).where(eq(formFields.templateId, templateId)).orderBy(formFields.order);
  }

  async createFormField(field: InsertFormField): Promise<FormField> {
    const [newField] = await db.insert(formFields).values(field).returning();
    return newField;
  }

  async updateFormField(id: number, field: Partial<InsertFormField>): Promise<FormField | undefined> {
    const [updatedField] = await db
      .update(formFields)
      .set(field)
      .where(eq(formFields.id, id))
      .returning();
    return updatedField;
  }

  async deleteFormField(id: number): Promise<boolean> {
    const result = await db.delete(formFields).where(eq(formFields.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Gap Assignment operations
  async getAssignmentsByGap(gapId: number): Promise<GapAssignment[]> {
    return await db.select().from(gapAssignments).where(eq(gapAssignments.gapId, gapId)).orderBy(desc(gapAssignments.assignedAt));
  }

  async createGapAssignment(assignment: InsertGapAssignment): Promise<GapAssignment> {
    const [newAssignment] = await db.insert(gapAssignments).values(assignment).returning();
    return newAssignment;
  }

  // TAT Extension operations
  async getExtensionsByGap(gapId: number): Promise<TatExtension[]> {
    return await db.select().from(tatExtensions).where(eq(tatExtensions.gapId, gapId)).orderBy(desc(tatExtensions.createdAt));
  }

  async getPendingExtensions(): Promise<TatExtension[]> {
    return await db.select().from(tatExtensions).where(eq(tatExtensions.status, 'Pending')).orderBy(desc(tatExtensions.createdAt));
  }

  async createTatExtension(extension: InsertTatExtension): Promise<TatExtension> {
    const [newExtension] = await db.insert(tatExtensions).values(extension).returning();
    return newExtension;
  }

  async updateTatExtension(id: number, extension: Partial<InsertTatExtension>): Promise<TatExtension | undefined> {
    const [updatedExtension] = await db
      .update(tatExtensions)
      .set(extension)
      .where(eq(tatExtensions.id, id))
      .returning();
    return updatedExtension;
  }

  // Similar Gap operations
  async getSimilarGaps(gapId: number, minScore: number = 60): Promise<SimilarGap[]> {
    return await db
      .select()
      .from(similarGaps)
      .where(
        and(
          eq(similarGaps.gapId, gapId),
          sql`${similarGaps.similarityScore} >= ${minScore}`
        )
      )
      .orderBy(desc(similarGaps.similarityScore));
  }

  async createSimilarGap(similarGap: InsertSimilarGap): Promise<SimilarGap> {
    const [newSimilarGap] = await db.insert(similarGaps).values(similarGap).returning();
    return newSimilarGap;
  }

  async deleteSimilarGapsByGapId(gapId: number): Promise<boolean> {
    const result = await db.delete(similarGaps).where(
      or(eq(similarGaps.gapId, gapId), eq(similarGaps.similarGapId, gapId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Audit Log operations
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByUser(userId: number, limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByEntity(entityType: string, entityId: number, limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId)
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [newAuditLog] = await db.insert(auditLogs).values(auditLog).returning();
    return newAuditLog;
  }
}

export const storage = new DatabaseStorage();
