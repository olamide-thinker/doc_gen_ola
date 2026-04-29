import { pgTable, text, varchar, timestamp, jsonb, uuid, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Shared Helpers for consistency ---
const timestamps = {
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
};

// Common context for easier filtering at any level
const projectContext = {
  businessId: text('business_id').references(() => businesses.id),
  projectId: text('project_id').references(() => projects.id),
};

// 1. Core Identity
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  phone: varchar('phone', { length: 256 }),
  businessId: text('business_id'),  // Current active business/org
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    emailIdx: uniqueIndex('email_idx').on(table.email),
  };
});

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  projectMembers: many(projectMembers),
  documents: many(documents),
  invoices: many(invoices),
  comments: many(comments),
}));

export const businesses = pgTable('businesses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    ownerIdx: index('owner_idx').on(table.ownerId),
  };
});

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerId],
    references: [users.id],
  }),
  projects: many(projects),
}));

// 2. Project Management
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businesses.id),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  members: text('members').array(),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    businessIdx: index('business_idx').on(table.businessId),
    projOwnerIdx: index('proj_owner_idx').on(table.ownerId),
    uniqueProjectName: uniqueIndex('unique_project_name').on(table.businessId, table.name),
  };
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  business: one(businesses, {
    fields: [projects.businessId],
    references: [businesses.id],
  }),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  members: many(projectMembers),
  folders: many(folders),
  documents: many(documents),
  invoices: many(invoices),
  tasks: many(tasks),
  stages: many(stages),
}));

export const projectMembers = pgTable('project_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull().references(() => users.id),
  email: text('email').notNull(),
  role: text('role').default('viewer'),
  members: text('members').array(),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    projIdIdx: index('project_id_idx').on(table.projectId),
    userIdIdx: index('user_id_idx').on(table.userId),
    uniqueMember: uniqueIndex('unique_project_member').on(table.projectId, table.userId),
  };
});

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

// 3. File System
export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path'), 
  members: text('members').array(), // Added for folder sharing
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    folderProjIdx: index('folder_project_idx').on(table.projectId),
  };
});

export const foldersRelations = relations(folders, ({ one, many }) => ({
  project: one(projects, {
    fields: [folders.projectId],
    references: [projects.id],
  }),
  documents: many(documents),
  invoices: many(invoices),
}));

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  folderId: text('folder_id').references(() => folders.id),
  name: text('name').notNull(),
  url: text('url').notNull(),
  mimetype: text('mimetype'),
  size: text('size'),
  metadata: jsonb('metadata'),
  members: text('members').array(),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    docProjIdx: index('doc_project_idx').on(table.projectId),
    docUserIdx: index('doc_user_idx').on(table.userId),
    docFolderIdx: index('doc_folder_idx').on(table.folderId),
  };
});

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  folder: one(folders, {
    fields: [documents.folderId],
    references: [folders.id],
  }),
  comments: many(comments),
}));

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  folderId: text('folder_id').references(() => folders.id),
  name: text('name').notNull(),
  content: jsonb('content'), // Legacy
  draft: jsonb('draft'), 
  activeVersionId: text('active_version_id'),
  status: text('status').default('draft'),
  members: text('members').array(),
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    invProjIdx: index('inv_project_idx').on(table.projectId),
    invUserIdx: index('inv_user_idx').on(table.userId),
    invFolderIdx: index('inv_folder_idx').on(table.folderId),
  };
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  folder: one(folders, {
    fields: [invoices.folderId],
    references: [folders.id],
  }),
  comments: many(comments),
  versions: many(invoiceVersions),
  receipts: many(receipts),
}));

export const invoiceVersions = pgTable('invoice_versions', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  versionNumber: text('version_number').notNull(),
  name: text('name'),
  content: jsonb('content').notNull(),
  pdfUrl: text('pdf_url'),
  publishedAt: timestamp('published_at').defaultNow(),
  publishedBy: text('published_by').references(() => users.id),
  voidedAt: timestamp('voided_at'),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
  metadata: jsonb('metadata'),
}, (table) => {
  return {
    invVerIdx: index('inv_ver_idx').on(table.invoiceId),
  };
});

export const invoiceVersionsRelations = relations(invoiceVersions, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceVersions.invoiceId],
    references: [invoices.id],
  }),
  publisher: one(users, {
    fields: [invoiceVersions.publishedBy],
    references: [users.id],
  }),
  voider: one(users, {
    fields: [invoiceVersions.voidedBy],
    references: [users.id],
  }),
}));

export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  draft: jsonb('draft'),
  activeVersionId: text('active_version_id'),
  status: text('status').default('draft'),
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    recInvIdx: index('rec_inv_idx').on(table.invoiceId),
  };
});

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [receipts.invoiceId],
    references: [invoices.id],
  }),
  versions: many(receiptVersions),
}));

export const receiptVersions = pgTable('receipt_versions', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull().references(() => receipts.id),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  versionNumber: text('version_number').notNull(),
  content: jsonb('content').notNull(),
  pdfUrl: text('pdf_url'),
  sequence: integer('sequence').notNull(), // Monotonically increasing per invoice
  publishedAt: timestamp('published_at').defaultNow(),
  publishedBy: text('published_by').references(() => users.id),
  voidedAt: timestamp('voided_at'),
  voidedBy: text('voided_by'),
  voidReason: text('void_reason'),
  metadata: jsonb('metadata'),
}, (table) => {
  return {
    recVerIdx: index('rec_ver_idx').on(table.receiptId),
    recVerInvIdx: index('rec_ver_inv_idx').on(table.invoiceId),
  };
});

export const receiptVersionsRelations = relations(receiptVersions, ({ one }) => ({
  receipt: one(receipts, {
    fields: [receiptVersions.receiptId],
    references: [receipts.id],
  }),
  invoice: one(invoices, {
    fields: [receiptVersions.invoiceId],
    references: [invoices.id],
  }),
  publisher: one(users, {
    fields: [receiptVersions.publishedBy],
    references: [users.id],
  }),
  voider: one(users, {
    fields: [receiptVersions.voidedBy],
    references: [users.id],
  }),
}));

// 4. Engagement
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  targetType: text('target_type').notNull(), // 'document' or 'invoice'
  targetId: text('target_id').notNull(),
  content: text('content').notNull(),
  position: jsonb('position'),
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    commentTargetIdx: index('comment_target_idx').on(table.targetId),
    commentUserIdx: index('comment_user_idx').on(table.userId),
  };
});

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

// 5. Tasks (project work items — Phase 1; stage/milestone wiring is Phase 3)
//
// Each task is scoped to a project. The taskCode (e.g. "TSK-001") is unique
// per project and computed from MAX(taskCode) at insert time in the service.
//
// Location is polymorphic-light: when locationType === 'zone', the pair
// (locationDocId, locationZoneId) points at a zone polygon inside a plan
// document's planData.zones array. When 'text', locationText is used.
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskCode: text('task_code').notNull(),

  // Identity / context
  title: text('title').notNull(),
  details: text('details'),
  status: text('status').notNull().default('pending'), // pending | progress | done | cancelled
  priority: text('priority').notNull().default('med'), // low | med | high

  deadline: timestamp('deadline'),

  // People
  createdById: text('created_by_id').references(() => users.id),
  supervisorId: text('supervisor_id').references(() => users.id),
  assigneeId: text('assignee_id').references(() => users.id),
  crewIds: text('crew_ids').array(),

  // Resources
  materials: jsonb('materials'), // [{ name, quantity, unit, note }]
  budget: integer('budget'), // smallest currency unit (kobo for NGN)

  // Location (zone reference OR free text)
  locationType: text('location_type'), // 'zone' | 'text' | null
  locationDocId: text('location_doc_id').references(() => documents.id),
  locationZoneId: text('location_zone_id'),
  locationText: text('location_text'),

  // Stage/milestone wiring — left nullable, populated in Phase 3
  stageId: text('stage_id'),
  milestoneId: text('milestone_id'),

  // Free-form metadata bag for forward compatibility
  metadata: jsonb('metadata'),

  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    taskProjectIdx: index('task_project_idx').on(table.projectId),
    taskAssigneeIdx: index('task_assignee_idx').on(table.assigneeId),
    taskStatusIdx: index('task_status_idx').on(table.status),
    uniqueTaskCodePerProject: uniqueIndex('unique_task_code_per_project').on(table.projectId, table.taskCode),
  };
});

// 6. Execution Plan — Stages (Phases) and Milestones
//
// A project's execution module: ordered stages, each containing ordered
// milestones, each containing tasks (linked via tasks.stageId / tasks.milestoneId).
// Status rolls up: all tasks done → milestone done → all milestones done →
// stage done → all stages done → project done.
export const stages = pgTable('stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  // Free-form timeline string ("Week 1", "Weeks 4–6") so the user picks the
  // unit. Hard dates are added later if/when scheduling needs them.
  timeline: text('timeline'),
  description: text('description'),
  note: text('note'),
  status: text('status').notNull().default('pending'), // pending | active | done | cancelled
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    stageProjectIdx: index('stage_project_idx').on(table.projectId),
    stageStatusIdx: index('stage_status_idx').on(table.status),
  };
});

export const stagesRelations = relations(stages, ({ one, many }) => ({
  project: one(projects, {
    fields: [stages.projectId],
    references: [projects.id],
  }),
  business: one(businesses, {
    fields: [stages.businessId],
    references: [businesses.id],
  }),
  milestones: many(milestones),
}));

export const milestones = pgTable('milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  stageId: uuid('stage_id').notNull().references(() => stages.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  description: text('description'),
  note: text('note'),
  status: text('status').notNull().default('pending'), // pending | active | done | cancelled
  metadata: jsonb('metadata'),
  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    milestoneStageIdx: index('milestone_stage_idx').on(table.stageId),
    milestoneProjectIdx: index('milestone_project_idx').on(table.projectId),
    milestoneStatusIdx: index('milestone_status_idx').on(table.status),
  };
});

export const milestonesRelations = relations(milestones, ({ one }) => ({
  stage: one(stages, {
    fields: [milestones.stageId],
    references: [stages.id],
  }),
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  business: one(businesses, {
    fields: [tasks.businessId],
    references: [businesses.id],
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'taskCreatedBy',
  }),
  supervisor: one(users, {
    fields: [tasks.supervisorId],
    references: [users.id],
    relationName: 'taskSupervisor',
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  locationDoc: one(documents, {
    fields: [tasks.locationDocId],
    references: [documents.id],
  }),
}));
