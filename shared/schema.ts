import { pgTable, text, integer, boolean, timestamp, serial, varchar, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  employeeId: varchar("employee_id", { length: 50 }).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // Admin, Management, QA/Ops, POC
  department: varchar("department", { length: 100 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, passwordHash: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Public user type that excludes sensitive fields
export type PublicUser = Omit<User, 'passwordHash'>;

export const gaps = pgTable("gaps", {
  id: serial("id").primaryKey(),
  gapId: varchar("gap_id", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("PendingAI"), // PendingAI, NeedsReview, Assigned, InProgress, Overdue, Resolved, Closed, Reopened
  priority: varchar("priority", { length: 50 }).notNull().default("Medium"), // High, Medium, Low
  severity: varchar("severity", { length: 50 }),
  department: varchar("department", { length: 100 }),
  reporterId: integer("reporter_id").references(() => users.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  formTemplateId: integer("form_template_id").references(() => formTemplates.id), // Link to form template used
  templateVersion: varchar("template_version", { length: 20 }), // Capture template version at submission
  formResponsesJson: jsonb("form_responses_json"), // Structured form responses
  tatDeadline: timestamp("tat_deadline"),
  assignedAt: timestamp("assigned_at"),
  inProgressAt: timestamp("in_progress_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  closedById: integer("closed_by_id").references(() => users.id),
  reopenedAt: timestamp("reopened_at"),
  reopenedById: integer("reopened_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedById: integer("updated_by_id").references(() => users.id),
  aiProcessed: boolean("ai_processed").default(false),
  attachments: jsonb("attachments").default([]),
  sopSuggestions: jsonb("sop_suggestions"),
  resolutionSummary: text("resolution_summary"),
  resolutionAttachments: jsonb("resolution_attachments").default([]),
  duplicateOfId: integer("duplicate_of_id").references(() => gaps.id),
});

export const insertGapSchema = createInsertSchema(gaps).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  gapId: true,
  assignedAt: true,
  inProgressAt: true,
  resolvedAt: true,
  closedAt: true,
  reopenedAt: true,
});
export type InsertGap = z.infer<typeof insertGapSchema>;
export type Gap = typeof gaps.$inferSelect;

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id, { onDelete: "cascade" }).notNull(),
  authorId: integer("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export const sops = pgTable("sops", {
  id: serial("id").primaryKey(),
  sopId: varchar("sop_id", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }),
  department: varchar("department", { length: 100 }),
  parentSopId: integer("parent_sop_id").references(() => sops.id, { onDelete: "set null" }), // For hierarchical structure
  version: varchar("version", { length: 20 }).default("1.0"),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  updatedById: integer("updated_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true),
  embeddings: jsonb("embeddings"), // Store AI embeddings for semantic search
});

export const insertSopSchema = createInsertSchema(sops).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  sopId: true,
  embeddings: true,
});
export type InsertSop = z.infer<typeof insertSopSchema>;
export type Sop = typeof sops.$inferSelect;

export const formTemplates = pgTable("form_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  schemaJson: jsonb("schema_json").notNull(), // Stores the complete form structure with sections, questions, conditional logic
  visibility: varchar("visibility", { length: 50 }).default("all"), // all, specific_department
  department: varchar("department", { length: 100 }),
  version: varchar("version", { length: 20 }).default("1.0"),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true),
});

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

export const formFields = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => formTemplates.id, { onDelete: "cascade" }).notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(), // text, textarea, select, multiselect, file
  label: text("label").notNull(),
  required: boolean("required").default(false),
  options: jsonb("options"), // for select/multiselect
  order: integer("order").notNull(),
});

export const insertFormFieldSchema = createInsertSchema(formFields).omit({ id: true });
export type InsertFormField = z.infer<typeof insertFormFieldSchema>;
export type FormField = typeof formFields.$inferSelect;

export const gapAssignments = pgTable("gap_assignments", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => users.id).notNull(),
  assignedById: integer("assigned_by_id").references(() => users.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  notes: text("notes"),
});

export const insertGapAssignmentSchema = createInsertSchema(gapAssignments).omit({ 
  id: true, 
  assignedAt: true,
});
export type InsertGapAssignment = z.infer<typeof insertGapAssignmentSchema>;
export type GapAssignment = typeof gapAssignments.$inferSelect;

export const gapPocs = pgTable("gap_pocs", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  addedById: integer("added_by_id").references(() => users.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  isPrimary: boolean("is_primary").default(false),
}, (table) => ({
  uniqueGapUser: unique().on(table.gapId, table.userId),
}));

export const insertGapPocSchema = createInsertSchema(gapPocs).omit({ 
  id: true, 
  addedAt: true,
});
export type InsertGapPoc = z.infer<typeof insertGapPocSchema>;
export type GapPoc = typeof gapPocs.$inferSelect;

export const tatExtensions = pgTable("tat_extensions", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id).notNull(),
  requestedById: integer("requested_by_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  requestedDeadline: timestamp("requested_deadline").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("Pending"), // Pending, Approved, Rejected
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTatExtensionSchema = createInsertSchema(tatExtensions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertTatExtension = z.infer<typeof insertTatExtensionSchema>;
export type TatExtension = typeof tatExtensions.$inferSelect;

export const resolutionHistory = pgTable("resolution_history", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id, { onDelete: "cascade" }).notNull(),
  resolutionSummary: text("resolution_summary").notNull(),
  resolutionAttachments: jsonb("resolution_attachments").default([]),
  resolvedById: integer("resolved_by_id").references(() => users.id).notNull(),
  resolvedAt: timestamp("resolved_at").notNull(),
  reopenedById: integer("reopened_by_id").references(() => users.id),
  reopenedAt: timestamp("reopened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  gapIdResolvedAtIdx: index("resolution_history_gap_id_resolved_at_idx").on(table.gapId, table.resolvedAt),
}));

export const insertResolutionHistorySchema = createInsertSchema(resolutionHistory).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertResolutionHistory = z.infer<typeof insertResolutionHistorySchema>;
export type ResolutionHistory = typeof resolutionHistory.$inferSelect;

export const similarGaps = pgTable("similar_gaps", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").references(() => gaps.id, { onDelete: "cascade" }).notNull(),
  similarGapId: integer("similar_gap_id").references(() => gaps.id, { onDelete: "cascade" }).notNull(),
  similarityScore: integer("similarity_score").notNull(), // 0-100
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => ({
  uniquePair: unique().on(table.gapId, table.similarGapId),
}));

export const insertSimilarGapSchema = createInsertSchema(similarGaps).omit({ 
  id: true, 
  calculatedAt: true 
});
export type InsertSimilarGap = z.infer<typeof insertSimilarGapSchema>;
export type SimilarGap = typeof similarGaps.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, LOGOUT, ASSIGN, etc.
  entityType: varchar("entity_type", { length: 50 }).notNull(), // gap, user, sop, comment, etc.
  entityId: integer("entity_id"),
  changes: jsonb("changes"), // What changed (before/after values)
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Notification Preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  frequency: varchar("frequency", { length: 20 }).default("immediate").notNull(), // immediate, daily, weekly
  channels: varchar("channels", { length: 50 }).default("both").notNull(), // in-app, email, both
  notifyGapAssigned: boolean("notify_gap_assigned").default(true),
  notifyGapResolved: boolean("notify_gap_resolved").default(true),
  notifyComment: boolean("notify_comment").default(true),
  notifyTatExtension: boolean("notify_tat_extension").default(true),
  notifyOverdueGap: boolean("notify_overdue_gap").default(true),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

// Recurring Gap Patterns - Track systemic issues
export const recurringGapPatterns = pgTable("recurring_gap_patterns", {
  id: serial("id").primaryKey(),
  patternKey: varchar("pattern_key", { length: 255 }).notNull().unique(), // Hash of similar gap characteristics
  gapIds: jsonb("gap_ids").default([]).notNull(), // Array of gap IDs with this pattern
  occurrenceCount: integer("occurrence_count").default(1).notNull(),
  department: varchar("department", { length: 100 }),
  isFlaggedAsSystemic: boolean("is_flagged_as_systemic").default(false),
  systemicSeverity: varchar("systemic_severity", { length: 20 }), // low, medium, high, critical
  commonTitle: text("common_title"), // Common theme/title of these gaps
  firstOccurrenceAt: timestamp("first_occurrence_at").notNull(),
  lastOccurrenceAt: timestamp("last_occurrence_at").notNull(),
  resolvedCount: integer("resolved_count").default(0),
  suggestedAction: text("suggested_action"), // Suggested root cause or prevention
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  patternKeyIdx: index("recurring_pattern_key_idx").on(table.patternKey),
  departmentIdx: index("recurring_department_idx").on(table.department),
}));

export const insertRecurringGapPatternSchema = createInsertSchema(recurringGapPatterns).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});
export type InsertRecurringGapPattern = z.infer<typeof insertRecurringGapPatternSchema>;
export type RecurringGapPattern = typeof recurringGapPatterns.$inferSelect;
