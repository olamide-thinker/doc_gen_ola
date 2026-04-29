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
  // userId/email are nullable so we can store company/vendor entries that
  // don't have a firebase account behind them. For real users, both are
  // populated as before.
  userId: text('user_id').references(() => users.id),
  email: text('email'),
  // kind decides how the row is rendered + which uniqueness rule applies.
  // 'user'    — real platform user (has userId + email)
  // 'company' — vendor / supplier / sub-contractor company
  // 'vendor'  — alias for company (kept distinct in case we want to split)
  kind: text('kind').notNull().default('user'),
  // For company/vendor entries, displayName is the human label ("Steel &
  // Sand Co."). For real users we leave it null and render email/full
  // name from the users table.
  displayName: text('display_name'),
  role: text('role').default('viewer'),
  members: text('members').array(),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    projIdIdx: index('project_id_idx').on(table.projectId),
    userIdIdx: index('user_id_idx').on(table.userId),
    // Old unique on (projectId, userId) is dropped — userId is now
    // nullable, and the constraint can't be enforced against null in
    // postgres anyway. We do a soft uniqueness check in the controller
    // for both shapes (one user per project, one display-name per
    // project for non-user kinds).
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

// 7. Field Reports — workflow + dialogue layer over tasks.
//
// A report is a first-class document filed by a team member (often the
// assignee). It can stand alone (general site observation) or attach to a
// task. Common shapes:
//   - kind=note:                 simple status update / observation
//   - kind=incident:             something went wrong; needs attention
//   - kind=update:               progress narrative
//   - kind=confirmation_request: assignee asks supervisor to apply a
//                                status change to a task. The `request`
//                                jsonb holds { targetTaskId, requestedStatus }.
//                                When resolved, `resolution` records who
//                                acted and whether they accepted.
//
// Every report also has its own thread (field_report_messages) so the
// back-and-forth lives in one place.
export const fieldReports = pgTable('field_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportCode: text('report_code').notNull(), // REP-NNNNN per project

  // Subject + scope
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  title: text('title'), // optional one-liner; falls back to first line of body
  body: text('body').notNull(),
  kind: text('kind').notNull().default('note'), // note | incident | update | confirmation_request

  // Author
  authorId: text('author_id').references(() => users.id),

  // Voice + transcription (V2 — kept here so the column exists from day one)
  voiceUrl: text('voice_url'),
  transcription: text('transcription'),

  // Attachments — array of { url, type: 'image'|'video'|'doc', label? }
  attachments: jsonb('attachments'),

  // Confirmation-request payload (only meaningful when kind === 'confirmation_request')
  // { targetTaskId: string, requestedStatus: string, note?: string }
  request: jsonb('request'),

  // Resolution of the request (null until acted on)
  // { status: 'accepted'|'declined', resolvedById: string, resolvedAt: ISO, note?: string }
  resolution: jsonb('resolution'),

  metadata: jsonb('metadata'),

  ...projectContext,
  ...timestamps,
}, (table) => {
  return {
    reportProjectIdx: index('report_project_idx').on(table.projectId),
    reportTaskIdx: index('report_task_idx').on(table.taskId),
    reportAuthorIdx: index('report_author_idx').on(table.authorId),
    reportKindIdx: index('report_kind_idx').on(table.kind),
    uniqueReportCodePerProject: uniqueIndex('unique_report_code_per_project')
      .on(table.projectId, table.reportCode),
  };
});

export const fieldReportsRelations = relations(fieldReports, ({ one, many }) => ({
  project: one(projects, {
    fields: [fieldReports.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [fieldReports.taskId],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [fieldReports.authorId],
    references: [users.id],
  }),
  messages: many(fieldReportMessages),
}));

// Thread of replies on a report. Mirrors the right-hand panel in the
// design — voice, text, image replies all live here.
export const fieldReportMessages = pgTable('field_report_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => fieldReports.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id),
  body: text('body'),
  voiceUrl: text('voice_url'),
  transcription: text('transcription'),
  attachments: jsonb('attachments'),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    msgReportIdx: index('msg_report_idx').on(table.reportId),
    msgAuthorIdx: index('msg_author_idx').on(table.authorId),
  };
});

export const fieldReportMessagesRelations = relations(fieldReportMessages, ({ one }) => ({
  report: one(fieldReports, {
    fields: [fieldReportMessages.reportId],
    references: [fieldReports.id],
  }),
  author: one(users, {
    fields: [fieldReportMessages.authorId],
    references: [users.id],
  }),
}));

// 8. Inventory — V1: just resource categories.
//
// Categories are the high-level resource groupings used across the
// business (Fuel, Labour, Materials, Equipment, Subcontractors…). They
// live at the business level so every project shares the same vocabulary
// — fewer "Materials" vs "materials" duplicates, and a single source of
// truth for the Accounting transaction log to render.
//
// V2 will layer in inventory_items inside each category (specific things
// like "Diesel · litres" or "Cement · 50kg bag"), but for now categories
// alone are enough for the Accounting page to group transactions.
export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: text('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // Optional visual marker for the Accounting log pills. Free-form so
  // the frontend can use a tailwind class, a hex, an emoji — whatever.
  color: text('color'),
  position: integer('position').notNull().default(0),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    invCatBusinessIdx: index('inv_cat_business_idx').on(table.businessId),
    // Names are unique within a business so picker dropdowns never show
    // ambiguous duplicates.
    uniqueInvCatNamePerBusiness: uniqueIndex('unique_inv_cat_name_per_business')
      .on(table.businessId, table.name),
  };
});

export const inventoryCategoriesRelations = relations(inventoryCategories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [inventoryCategories.businessId],
    references: [businesses.id],
  }),
  items: many(inventoryItems),
}));

// 9. Inventory items — the actual things crews request and invoices line.
//
// Categories are the high-level bucket (Materials, Labour, Fuel…); items
// are the granular, requestable, trackable thing — "Dangote Cement",
// "1.5mm cable", "Chandelier", "Paint (small bucket)". Every item
// belongs to exactly one category.
//
// Cost / supplier are V2-friendly defaults on the item record. Specific
// transactions can override them (an invoice line item can charge a
// different price than the catalog default — the default is just a
// hint when typing fresh).
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: text('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  // When a category is deleted, items go with it. The InventoryPage
  // delete flow warns about item count so this is never a surprise.
  categoryId: uuid('category_id')
    .notNull()
    .references(() => inventoryCategories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'), // optional business-defined SKU / code
  unit: text('unit').notNull().default('piece'), // bag, ton, m, m², litre, piece…
  // Default per-unit cost in the smallest currency unit (kobo for NGN).
  // Optional — items don't have to be priced in advance.
  defaultCost: integer('default_cost'),
  description: text('description'),
  position: integer('position').notNull().default(0),
  metadata: jsonb('metadata'),
  ...timestamps,
}, (table) => {
  return {
    invItemBusinessIdx: index('inv_item_business_idx').on(table.businessId),
    invItemCategoryIdx: index('inv_item_category_idx').on(table.categoryId),
    // One name per business — duplicate "Dangote Cement" entries across
    // categories would be confusing for crew search/typing. Picker
    // dropdowns stay clean.
    uniqueInvItemNamePerBusiness: uniqueIndex('unique_inv_item_name_per_business')
      .on(table.businessId, table.name),
  };
});

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  business: one(businesses, {
    fields: [inventoryItems.businessId],
    references: [businesses.id],
  }),
  category: one(inventoryCategories, {
    fields: [inventoryItems.categoryId],
    references: [inventoryCategories.id],
  }),
}));
