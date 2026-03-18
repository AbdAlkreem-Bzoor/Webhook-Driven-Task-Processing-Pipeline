import { pgTable, uuid, varchar, boolean, timestamp, integer, text, pgEnum } from 'drizzle-orm/pg-core';


// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('user_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  hashedPassword: varchar("hashed_password", { length: 256 }).notNull().default("unset"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date())
});

export type User = typeof users.$inferSelect;

export const userRoles = pgTable("user_roles", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
});

export type UserRole = typeof userRoles.$inferSelect;

export const userClaims = pgTable("user_claims", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    value: text("value").notNull(),
});

export type UserClaim = typeof userClaims.$inferSelect;

// Refresh Tokens table
export const refreshTokens = pgTable('refresh_tokens', {
  token: varchar("token", { length: 256 }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date())
});

export type RefreshToken = typeof refreshTokens.$inferSelect;



// Pipelines table
export const pipelines = pgTable('pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  sourceId: uuid('source_id').notNull().defaultRandom().unique(),
  payloadSchema: text('payload_schema'),
  webhookSecret: varchar('webhook_secret', { length: 255 }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: varchar('updated_by', { length: 255 })
});

export type Pipeline = typeof pipelines.$inferSelect;




// Processing Actions table
export const processingActionTypeEnum = pgEnum('processingactiontype', [
  'Validate',
  'Transform',
  'Enrich',
]);

export type ProcessingActionType = 'Validate' | 'Transform' | 'Enrich';

export const processingActions = pgTable('processing_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  order: integer('order').notNull(),
  actionType: processingActionTypeEnum('action_type').notNull(),
  configuration: text('configuration').notNull().default('{}'),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: varchar('updated_by', { length: 255 })
});

export type ProcessingAction = typeof processingActions.$inferSelect;



// Jobs table
export const jobStatusEnum = pgEnum('jobstatus', [
  'Queued',
  'Processing',
  'Completed',
  'Failed',
  'Filtered',
]);

export type JobStatus = 'Queued' | 'Processing' | 'Completed' | 'Failed' | 'Filtered';

export const deliveryStatusEnum = pgEnum('deliverystatus', [
  'Pending',
  'Dispatching',
  'Delivered',
  'PartiallyFailed',
  'Failed',
]);

export type DeliveryStatus = 'Pending' | 'Dispatching' | 'Delivered' | 'PartiallyFailed' | 'Failed';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  status: jobStatusEnum('status').notNull().default('Queued'),
  incomingPayload: text('incoming_payload').notNull(),
  processedPayload: text('processed_payload'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
  deliveryStatus: deliveryStatusEnum('delivery_status').notNull().default('Pending'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: varchar('updated_by', { length: 255 })
});

export type Job = typeof jobs.$inferSelect;




// Subscribers table
export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  url: varchar('url', { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: varchar('updated_by', { length: 255 })
});

export type Subscriber = typeof subscribers.$inferSelect;




// Delivery Attempts table
export const deliveryAttempts = pgTable('delivery_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  subscriberId: uuid('subscriber_id').references(() => subscribers.id, { onDelete: "cascade" }).notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  httpStatusCode: integer('http_status_code').notNull().default(200),
  success: boolean('success').notNull().default(false),
  errorMessage: text('error_message'),
  attemptedAt: timestamp('attempted_at').notNull().defaultNow(),
});

export type DeliveryAttempt = typeof deliveryAttempts.$inferSelect;




// Outbox Messages table
export const eventTypeEnum = pgEnum('eventtype', [
  'JobCreated',
  'JobCompleted',
  'JobFailed',
]);

export type EventType = 'JobCreated' | 'JobCompleted' | 'JobFailed';

export const outboxMessages = pgTable('outbox_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: eventTypeEnum('event_type').notNull(),
  payload: text('payload').notNull(),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: varchar('updated_by', { length: 255 })
});

export type OutboxMessage = typeof outboxMessages.$inferSelect;