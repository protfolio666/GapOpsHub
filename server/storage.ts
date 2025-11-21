import { db } from "./db";
import { 
  users, gaps, comments, sops, formTemplates, formFields, 
  gapAssignments, tatExtensions, similarGaps, auditLogs, gapPocs, resolutionHistory,
  notificationPreferences, recurringGapPatterns,
  type User, type InsertUser, type Gap, type InsertGap,
  type Comment, type InsertComment, type Sop, type InsertSop,
  type FormTemplate, type InsertFormTemplate, type FormField, type InsertFormField,
  type GapAssignment, type InsertGapAssignment, type TatExtension, type InsertTatExtension,
  type SimilarGap, type InsertSimilarGap, type AuditLog, type InsertAuditLog,
  type GapPoc, type InsertGapPoc, type PublicUser, type ResolutionHistory, type InsertResolutionHistory,
  type NotificationPreferences, type InsertNotificationPreferences, type RecurringGapPattern, type InsertRecurringGapPattern
} from "@shared/schema";
import { eq, desc, and, sql, or, inArray } from "drizzle-orm";

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
  resolveGap(id: number, resolutionSummary: string, resolutionAttachments: any[], updatedById?: number): Promise<Gap | undefined>;
  getAllGapAttachments(gapId: number): Promise<any[]>;
  getFilteredGaps(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    userIds?: number[];
    roles?: string[];
    departments?: string[];
    employeeIds?: string[];
    emails?: string[];
    templateIds?: number[];
    statuses?: string[];
  }): Promise<Gap[]>;
  
  // Resolution History operations
  getResolutionHistory(gapId: number): Promise<ResolutionHistory[]>;
  createResolutionHistory(history: InsertResolutionHistory): Promise<ResolutionHistory>;
  getGapTimeline(gapId: number): Promise<Array<{
    type: string;
    occurredAt: Date;
    actorId: number | null;
    actor: PublicUser | null;
    metadata: any;
  }>>;
  
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
  getSopsByParent(parentSopId: number): Promise<Sop[]>;
  searchSops(query: string): Promise<Sop[]>;
  createSop(sop: InsertSop): Promise<Sop>;
  updateSop(id: number, sop: Partial<InsertSop>): Promise<Sop | undefined>;
  deleteSop(id: number): Promise<boolean>;
  
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
  
  // Gap POC operations
  getGapPocs(gapId: number): Promise<Array<GapPoc & { user: PublicUser }>>;
  getGapPocsWithDetails(gapId: number): Promise<Array<GapPoc & { user: PublicUser; addedBy: PublicUser }>>;
  addGapPoc(poc: InsertGapPoc): Promise<GapPoc>;
  removeGapPoc(gapId: number, userId: number): Promise<boolean>;
  isUserAssignedPoc(gapId: number, userId: number): Promise<boolean>;
  
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
  
  // POC Performance operations
  getPocPerformanceMetrics(pocId?: number): Promise<any[]>;
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

  async getGapsByPoc(pocId: number): Promise<Gap[]> {
    // Get gaps where POC is primary assignee
    const primaryGaps = await db
      .select()
      .from(gaps)
      .where(eq(gaps.assignedToId, pocId))
      .orderBy(desc(gaps.createdAt));
    
    // Get gaps where POC is in the POC list
    const pocListGaps = await db
      .select({ gap: gaps })
      .from(gapPocs)
      .innerJoin(gaps, eq(gapPocs.gapId, gaps.id))
      .where(eq(gapPocs.userId, pocId))
      .orderBy(desc(gaps.createdAt));
    
    // Combine and deduplicate
    const allGaps = [...primaryGaps];
    const primaryGapIds = new Set(primaryGaps.map(g => g.id));
    
    pocListGaps.forEach(({ gap }) => {
      if (!primaryGapIds.has(gap.id)) {
        allGaps.push(gap);
      }
    });
    
    return allGaps;
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

  async resolveGap(id: number, resolutionSummary: string, resolutionAttachments: string[], updatedById?: number): Promise<Gap | undefined> {
    const [resolvedGap] = await db
      .update(gaps)
      .set({ 
        status: "Resolved",
        resolutionSummary,
        resolutionAttachments: resolutionAttachments as any,
        resolvedAt: new Date(),
        updatedAt: new Date(),
        updatedById: updatedById || null
      })
      .where(eq(gaps.id, id))
      .returning();
    return resolvedGap;
  }

  async getAllGapAttachments(gapId: number): Promise<any[]> {
    const allAttachments: any[] = [];
    
    const gap = await this.getGap(gapId);
    if (!gap) return allAttachments;
    
    // Add main gap attachments (from form submissions)
    if (gap.attachments && Array.isArray(gap.attachments)) {
      gap.attachments.forEach((attachment: any) => {
        allAttachments.push({
          ...attachment,
          source: 'gap',
          sourceId: gap.id
        });
      });
    }
    
    // Add resolution attachments
    if (gap.resolutionAttachments && Array.isArray(gap.resolutionAttachments)) {
      gap.resolutionAttachments.forEach((attachment: any) => {
        allAttachments.push({
          ...attachment,
          source: 'resolution',
          sourceId: gap.id
        });
      });
    }
    
    // Add comment attachments
    const gapComments = await this.getCommentsByGap(gapId);
    gapComments.forEach(comment => {
      if (comment.attachments && Array.isArray(comment.attachments)) {
        (comment.attachments as any[]).forEach((attachment: any) => {
          allAttachments.push({
            ...attachment,
            source: 'comment',
            sourceId: comment.id,
            commentAuthor: comment.authorId
          });
        });
      }
    });
    
    return allAttachments;
  }

  async getFilteredGaps(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    userIds?: number[];
    roles?: string[];
    departments?: string[];
    employeeIds?: string[];
    emails?: string[];
    templateIds?: number[];
    statuses?: string[];
  }): Promise<Gap[]> {
    const conditions = [];
    
    // Date range filter
    if (filters.dateFrom) {
      conditions.push(sql`${gaps.createdAt} >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${gaps.createdAt} <= ${filters.dateTo}`);
    }
    
    // Template filter
    if (filters.templateIds && filters.templateIds.length > 0) {
      conditions.push(inArray(gaps.formTemplateId, filters.templateIds));
    }
    
    // Status filter
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(gaps.status, filters.statuses));
    }
    
    // Department filter
    if (filters.departments && filters.departments.length > 0) {
      conditions.push(inArray(gaps.department, filters.departments));
    }
    
    // User-based filters (reporter or assignee)
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(
        or(
          inArray(gaps.reporterId, filters.userIds),
          inArray(gaps.assignedToId, filters.userIds)
        )
      );
    }
    
    // If we have role/employeeId/email filters, we need to join with users table
    let query;
    if (filters.roles?.length || filters.employeeIds?.length || filters.emails?.length) {
      const userConditions = [];
      
      if (filters.roles && filters.roles.length > 0) {
        userConditions.push(inArray(users.role, filters.roles));
      }
      if (filters.employeeIds && filters.employeeIds.length > 0) {
        userConditions.push(inArray(users.employeeId, filters.employeeIds));
      }
      if (filters.emails && filters.emails.length > 0) {
        userConditions.push(inArray(users.email, filters.emails));
      }
      
      // Get user IDs matching these criteria
      const matchingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(...userConditions));
      
      const matchingUserIds = matchingUsers.map(u => u.id);
      
      if (matchingUserIds.length > 0) {
        conditions.push(
          or(
            sql`${gaps.reporterId} = ANY(${matchingUserIds})`,
            sql`${gaps.assignedToId} = ANY(${matchingUserIds})`
          )
        );
      } else {
        // No matching users found, return empty array
        return [];
      }
    }
    
    // Build final query
    if (conditions.length > 0) {
      return await db
        .select()
        .from(gaps)
        .where(and(...conditions))
        .orderBy(desc(gaps.createdAt));
    } else {
      return await db
        .select()
        .from(gaps)
        .orderBy(desc(gaps.createdAt));
    }
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

  // Resolution History operations
  async getResolutionHistory(gapId: number): Promise<ResolutionHistory[]> {
    return await db
      .select()
      .from(resolutionHistory)
      .where(eq(resolutionHistory.gapId, gapId))
      .orderBy(desc(resolutionHistory.resolvedAt));
  }

  async createResolutionHistory(history: InsertResolutionHistory): Promise<ResolutionHistory> {
    const [newHistory] = await db
      .insert(resolutionHistory)
      .values({
        ...history,
        resolutionAttachments: history.resolutionAttachments as any,
      } as any)
      .returning();
    return newHistory;
  }

  async getGapTimeline(gapId: number): Promise<Array<{
    type: string;
    occurredAt: Date;
    actorId: number | null;
    actor: PublicUser | null;
    metadata: any;
  }>> {
    const gap = await this.getGap(gapId);
    if (!gap) return [];

    const events: Array<{
      type: string;
      occurredAt: Date;
      actorId: number | null;
      actor: PublicUser | null;
      metadata: any;
    }> = [];

    events.push({
      type: 'created',
      occurredAt: new Date(gap.createdAt),
      actorId: gap.reporterId,
      actor: null,
      metadata: { title: gap.title, priority: gap.priority }
    });

    if (gap.assignedAt && gap.assignedToId) {
      events.push({
        type: 'assigned',
        occurredAt: new Date(gap.assignedAt),
        actorId: gap.assignedToId,
        actor: null,
        metadata: { assignedToId: gap.assignedToId }
      });
    }

    if (gap.inProgressAt) {
      events.push({
        type: 'in_progress',
        occurredAt: new Date(gap.inProgressAt),
        actorId: gap.updatedById,
        actor: null,
        metadata: {}
      });
    }

    const history = await this.getResolutionHistory(gapId);
    for (const entry of history) {
      events.push({
        type: 'resolved',
        occurredAt: new Date(entry.resolvedAt),
        actorId: entry.resolvedById,
        actor: null,
        metadata: {
          resolutionSummary: entry.resolutionSummary,
          resolutionAttachments: entry.resolutionAttachments
        }
      });

      if (entry.reopenedAt && entry.reopenedById) {
        events.push({
          type: 'reopened',
          occurredAt: new Date(entry.reopenedAt),
          actorId: entry.reopenedById,
          actor: null,
          metadata: {}
        });
      }
    }

    if (gap.status === 'Resolved' && gap.resolvedAt) {
      const alreadyHasThisResolution = events.some(
        e => e.type === 'resolved' && 
        Math.abs(new Date(e.occurredAt).getTime() - new Date(gap.resolvedAt!).getTime()) < 1000
      );
      if (!alreadyHasThisResolution) {
        events.push({
          type: 'resolved',
          occurredAt: new Date(gap.resolvedAt),
          actorId: gap.updatedById || gap.assignedToId,
          actor: null,
          metadata: {
            resolutionSummary: gap.resolutionSummary,
            resolutionAttachments: gap.resolutionAttachments
          }
        });
      }
    }

    if (gap.status === 'Reopened' && gap.reopenedAt && gap.reopenedById) {
      const alreadyHasThisReopen = events.some(
        e => e.type === 'reopened' && 
        Math.abs(new Date(e.occurredAt).getTime() - new Date(gap.reopenedAt!).getTime()) < 1000
      );
      if (!alreadyHasThisReopen) {
        events.push({
          type: 'reopened',
          occurredAt: new Date(gap.reopenedAt),
          actorId: gap.reopenedById,
          actor: null,
          metadata: {}
        });
      }
    }

    if (gap.closedAt) {
      events.push({
        type: 'closed',
        occurredAt: new Date(gap.closedAt),
        actorId: gap.closedById,
        actor: null,
        metadata: { duplicateOfId: gap.duplicateOfId }
      });
    }

    // Merge audit log events
    const auditLogs = await this.getAuditLogsByEntity('gap', gapId);
    for (const log of auditLogs) {
      // Skip if we already have an event for this action at this time
      const isDuplicate = events.some(
        e => e.type === log.action && 
        Math.abs(new Date(e.occurredAt).getTime() - new Date(log.createdAt).getTime()) < 2000
      );
      
      if (!isDuplicate) {
        events.push({
          type: log.action,
          occurredAt: new Date(log.createdAt),
          actorId: log.userId,
          actor: null,
          metadata: log.details || {}
        });
      }
    }

    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    for (const event of events) {
      if (event.actorId) {
        const actor = await this.getUser(event.actorId);
        if (actor) {
          event.actor = {
            id: actor.id,
            name: actor.name,
            email: actor.email,
            role: actor.role,
            employeeId: actor.employeeId,
            department: actor.department,
            createdAt: actor.createdAt
          };
        }
      }
    }

    return events;
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
    // Generate hierarchical SOP ID
    let sopId: string;
    
    if (sop.parentSopId) {
      // For child SOPs: get parent SOP and count existing children
      const parentSop = await this.getSop(sop.parentSopId);
      if (!parentSop) {
        throw new Error("Parent SOP not found");
      }
      
      // Count children of this parent
      const childCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(sops)
        .where(eq(sops.parentSopId, sop.parentSopId));
      
      const childNumber = (Number(childCount[0].count) + 1).toString().padStart(2, '0');
      sopId = `${parentSop.sopId}-#${childNumber}`;
    } else {
      // For root SOPs: generate standard numbering
      const count = await db.select({ count: sql<number>`count(*)` }).from(sops).where(sql`${sops.parentSopId} IS NULL`);
      const sopNumber = (Number(count[0].count) + 1).toString().padStart(3, '0');
      sopId = `SOP-${sopNumber}`;
    }
    
    const [newSop] = await db.insert(sops).values({ ...sop, sopId }).returning();
    return newSop;
  }

  async updateSop(id: number, sop: Partial<InsertSop>): Promise<Sop | undefined> {
    // If parentSopId is being changed, regenerate sopId
    let updateData: any = { ...sop, updatedAt: new Date() };
    
    if (sop.parentSopId !== undefined) {
      const currentSop = await this.getSop(id);
      if (currentSop && currentSop.parentSopId !== sop.parentSopId) {
        // Parent is being changed, regenerate ID
        if (sop.parentSopId) {
          const parentSop = await this.getSop(sop.parentSopId);
          if (!parentSop) {
            throw new Error("Parent SOP not found");
          }
          
          const childCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(sops)
            .where(eq(sops.parentSopId, sop.parentSopId));
          
          const childNumber = (Number(childCount[0].count) + 1).toString().padStart(2, '0');
          updateData.sopId = `${parentSop.sopId}-#${childNumber}`;
        } else {
          // Moving from child to root - assign new root SOP ID
          const count = await db.select({ count: sql<number>`count(*)` }).from(sops).where(sql`${sops.parentSopId} IS NULL`);
          const sopNumber = (Number(count[0].count) + 1).toString().padStart(3, '0');
          updateData.sopId = `SOP-${sopNumber}`;
        }
      }
    }
    
    const [updatedSop] = await db
      .update(sops)
      .set(updateData)
      .where(eq(sops.id, id))
      .returning();
    return updatedSop;
  }

  async deleteSop(id: number): Promise<boolean> {
    await db.delete(sops).where(eq(sops.id, id));
    return true;
  }

  async getSopsByParent(parentSopId: number): Promise<Sop[]> {
    return await db.select().from(sops).where(eq(sops.parentSopId, parentSopId)).orderBy(desc(sops.createdAt));
  }

  async searchSops(query: string): Promise<Sop[]> {
    const searchTerm = `%${query}%`;
    return await db
      .select()
      .from(sops)
      .where(
        or(
          sql`title ILIKE ${searchTerm}`,
          sql`description ILIKE ${searchTerm}`,
          sql`content ILIKE ${searchTerm}`
        )
      )
      .orderBy(desc(sops.createdAt));
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

  // Gap POC operations
  async getGapPocs(gapId: number): Promise<Array<GapPoc & { user: PublicUser }>> {
    const pocs = await db
      .select({
        id: gapPocs.id,
        gapId: gapPocs.gapId,
        userId: gapPocs.userId,
        addedById: gapPocs.addedById,
        addedAt: gapPocs.addedAt,
        isPrimary: gapPocs.isPrimary,
        user: {
          id: users.id,
          email: users.email,
          employeeId: users.employeeId,
          name: users.name,
          role: users.role,
          department: users.department,
          createdAt: users.createdAt,
        }
      })
      .from(gapPocs)
      .leftJoin(users, eq(gapPocs.userId, users.id))
      .where(eq(gapPocs.gapId, gapId))
      .orderBy(desc(gapPocs.isPrimary), gapPocs.addedAt);
    
    return pocs as Array<GapPoc & { user: PublicUser }>;
  }

  async getGapPocsWithDetails(gapId: number): Promise<Array<GapPoc & { user: PublicUser; addedBy: PublicUser }>> {
    const pocRecords = await db
      .select()
      .from(gapPocs)
      .where(eq(gapPocs.gapId, gapId))
      .orderBy(desc(gapPocs.isPrimary), gapPocs.addedAt);
    
    const pocsWithDetails = await Promise.all(
      pocRecords.map(async (poc) => {
        const pocUser = await this.getUser(poc.userId);
        const addedByUser = await this.getUser(poc.addedById);
        
        return {
          ...poc,
          user: pocUser ? {
            id: pocUser.id,
            email: pocUser.email,
            employeeId: pocUser.employeeId,
            name: pocUser.name,
            role: pocUser.role,
            department: pocUser.department,
            createdAt: pocUser.createdAt,
          } as PublicUser : {} as PublicUser,
          addedBy: addedByUser ? {
            id: addedByUser.id,
            email: addedByUser.email,
            employeeId: addedByUser.employeeId,
            name: addedByUser.name,
            role: addedByUser.role,
            department: addedByUser.department,
            createdAt: addedByUser.createdAt,
          } as PublicUser : {} as PublicUser,
        };
      })
    );
    
    return pocsWithDetails;
  }

  async addGapPoc(poc: InsertGapPoc): Promise<GapPoc> {
    const [newPoc] = await db.insert(gapPocs).values(poc).returning();
    return newPoc;
  }

  async removeGapPoc(gapId: number, userId: number): Promise<boolean> {
    const result = await db.delete(gapPocs).where(
      and(
        eq(gapPocs.gapId, gapId),
        eq(gapPocs.userId, userId)
      )
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async isUserAssignedPoc(gapId: number, userId: number): Promise<boolean> {
    const [poc] = await db
      .select()
      .from(gapPocs)
      .where(
        and(
          eq(gapPocs.gapId, gapId),
          eq(gapPocs.userId, userId)
        )
      )
      .limit(1);
    return !!poc;
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

  // POC Performance operations
  async getPocPerformanceMetrics(pocId?: number): Promise<any[]> {
    // Get all POC users or specific POC
    const pocUsers = pocId 
      ? await db.select().from(users).where(eq(users.id, pocId))
      : await db.select().from(users).where(eq(users.role, "POC"));

    const performanceData = await Promise.all(
      pocUsers.map(async (poc) => {
        // Get all gaps where POC is assigned (primary assignee or in POC list)
        const primaryGaps = await db
          .select()
          .from(gaps)
          .where(eq(gaps.assignedToId, poc.id));
        
        const pocListGaps = await db
          .select({ gap: gaps })
          .from(gapPocs)
          .innerJoin(gaps, eq(gapPocs.gapId, gaps.id))
          .where(eq(gapPocs.userId, poc.id));
        
        // Combine and deduplicate gaps
        const allGapIds = new Set([
          ...primaryGaps.map(g => g.id),
          ...pocListGaps.map(g => g.gap.id)
        ]);
        const allGaps = allGapIds.size > 0
          ? await db
              .select()
              .from(gaps)
              .where(inArray(gaps.id, Array.from(allGapIds)))
          : [];
        
        const totalAssigned = allGaps.length;
        
        // Use timeline to count all resolutions and reopens (not just current status)
        let totalResolved = 0;
        let totalReopened = 0;
        const gapsWithReopens: any[] = [];
        
        for (const gap of allGaps) {
          const timeline = await this.getGapTimeline(gap.id);
          const resolutions = timeline.filter(e => e.type === 'resolved');
          const reopens = timeline.filter(e => e.type === 'reopened');
          
          totalResolved += resolutions.length;
          totalReopened += reopens.length;
          
          if (reopens.length > 0) {
            gapsWithReopens.push({
              gapId: gap.gapId,
              gapTitle: gap.title,
              reopenCount: reopens.length,
              reopenDates: reopens.map(e => e.occurredAt),
              resolutions: resolutions.map(e => ({
                resolvedAt: e.occurredAt,
                resolution: e.metadata?.resolutionSummary || "N/A"
              }))
            });
          }
        }
        
        const reopenHistory = gapsWithReopens;
        
        // Count TAT extension requests by this POC
        const pocExtensions = await db
          .select()
          .from(tatExtensions)
          .where(eq(tatExtensions.requestedById, poc.id));
        const totalTatExtensions = pocExtensions.length;
        
        // Count delayed responses (resolved after TAT deadline OR currently overdue)
        const now = new Date();
        const delayedResponses = allGaps.filter(gap => {
          if (!gap.tatDeadline) return false;
          
          // If resolved, check if resolved after deadline
          if (gap.resolvedAt) {
            return new Date(gap.resolvedAt) > new Date(gap.tatDeadline);
          }
          
          // If not resolved, check if currently overdue
          const isOverdue = new Date(gap.tatDeadline) < now && 
                           !["Resolved", "Closed"].includes(gap.status);
          return isOverdue;
        });
        const totalDelayed = delayedResponses.length;
        
        // Count only resolved gaps that were delayed
        const resolvedDelayed = allGaps.filter(gap => {
          if (!gap.tatDeadline || !gap.resolvedAt) return false;
          if (gap.status !== "Resolved" && gap.status !== "Closed") return false;
          return new Date(gap.resolvedAt) > new Date(gap.tatDeadline);
        });
        
        return {
          poc: {
            id: poc.id,
            name: poc.name,
            email: poc.email,
            employeeId: poc.employeeId
          },
          metrics: {
            totalAssigned,
            totalResolved,
            totalReopened,
            reopenRate: totalResolved > 0 ? ((totalReopened / totalResolved) * 100).toFixed(2) : "0.00",
            totalTatExtensions,
            totalDelayed,
            // Calculate delayed rate based on total assigned (to show live performance)
            delayedRate: totalAssigned > 0 ? ((totalDelayed / totalAssigned) * 100).toFixed(2) : "0.00",
            resolvedDelayed: resolvedDelayed.length
          },
          reopenHistory
        };
      })
    );

    return performanceData;
  }
}

export const storage = new DatabaseStorage();
