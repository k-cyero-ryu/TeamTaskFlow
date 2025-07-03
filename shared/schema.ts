import { pgTable, text, serial, timestamp, integer, boolean, json, unique, varchar, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Existing tables remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  notificationPreferences: jsonb("notification_preferences").default({
    taskAssigned: true,
    taskUpdated: true,
    taskCommented: true,
    mentionedInComment: true,
    privateMessage: true,
    groupMessage: false,
    taskDueReminder: true
  }),
});

// Create group channels table
export const groupChannels = pgTable("group_channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  isPrivate: boolean("is_private").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Create channel members table
export const channelMembers = pgTable("channel_members", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => groupChannels.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  isAdmin: boolean("is_admin").default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => {
  return {
    userChannelUnique: unique().on(table.channelId, table.userId)
  };
});

// Create group messages table
export const groupMessages = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  channelId: integer("channel_id").references(() => groupChannels.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Add workflows table
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  isDefault: boolean("is_default").default(false),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Add workflow stages table
export const workflowStages = pgTable("workflow_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  order: integer("order").notNull(),
  color: text("color"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Add workflow transitions table
export const workflowTransitions = pgTable("workflow_transitions", {
  id: serial("id").primaryKey(),
  fromStageId: integer("from_stage_id").references(() => workflowStages.id).notNull(),
  toStageId: integer("to_stage_id").references(() => workflowStages.id).notNull(),
  conditions: json("conditions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Modify tasks table to include workflowId and stageId
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  responsibleId: integer("responsible_id").references(() => users.id),
  workflowId: integer("workflow_id").references(() => workflows.id),
  stageId: integer("stage_id").references(() => workflowStages.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



export const subtasks = pgTable("subtasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskSteps = pgTable("task_steps", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  completed: boolean("completed").notNull().default(false),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskParticipants = pgTable("task_participants", {
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const taskHistory = pgTable("task_history", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // created, status_changed, due_date_changed, assigned, unassigned, etc.
  oldValue: text("old_value"), // previous value (for changes)
  newValue: text("new_value"), // new value (for changes)
  details: text("details"), // additional details like subtask name, step title, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const privateMessages = pgTable("private_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
});

// File attachment table
export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  size: integer("size").notNull(), // size in bytes
  path: text("path").notNull(),
  uploaderId: integer("uploader_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Attachment associations for private messages
export const privateMessageAttachments = pgTable("private_message_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => privateMessages.id).notNull(),
  fileId: integer("file_id").references(() => fileAttachments.id).notNull(),
});

// Attachment associations for group messages
export const groupMessageAttachments = pgTable("group_message_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => groupMessages.id).notNull(),
  fileId: integer("file_id").references(() => fileAttachments.id).notNull(),
});

// Attachment associations for comments
export const commentAttachments = pgTable("comment_attachments", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").references(() => comments.id).notNull(),
  fileId: integer("file_id").references(() => fileAttachments.id).notNull(),
});

// Email notifications table
export const emailNotifications = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), // task_assigned, task_updated, task_commented, mentioned, etc.
  status: text("status").notNull().default("pending"), // pending, sent, failed
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  sentAt: timestamp("sent_at"),
  error: text("error_message"),
  relatedEntityId: integer("related_entity_id"), // ID of the related task, comment, etc.
  relatedEntityType: text("related_entity_type"), // task, comment, etc.
  recipientEmail: text("recipient_email"), // The email address to send the notification to
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Calendar events table
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  allDay: boolean("all_day").default(false),
  type: text("type").notNull(), // task_due, meeting, etc.
  relatedEntityId: integer("related_entity_id"), // ID of the related task
  relatedEntityType: text("related_entity_type"), // task, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
  }),
  responsible: one(users, {
    fields: [tasks.responsibleId],
    references: [users.id],
  }),
  workflow: one(workflows, {
    fields: [tasks.workflowId],
    references: [workflows.id],
  }),
  stage: one(workflowStages, {
    fields: [tasks.stageId],
    references: [workflowStages.id],
  }),
  participants: many(taskParticipants),
  subtasks: many(subtasks),
  steps: many(taskSteps),
  comments: many(comments),
  history: many(taskHistory),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.taskId],
    references: [tasks.id],
  }),
}));

export const taskStepsRelations = relations(taskSteps, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSteps.taskId],
    references: [tasks.id],
  }),
}));

export const taskParticipantsRelations = relations(taskParticipants, ({ one }) => ({
  task: one(tasks, {
    fields: [taskParticipants.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskParticipants.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  attachments: many(commentAttachments),
}));

export const taskHistoryRelations = relations(taskHistory, ({ one }) => ({
  task: one(tasks, {
    fields: [taskHistory.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskHistory.userId],
    references: [users.id],
  }),
}));

export const privateMessagesRelations = relations(privateMessages, ({ one, many }) => ({
  sender: one(users, {
    fields: [privateMessages.senderId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [privateMessages.recipientId],
    references: [users.id],
  }),
  attachments: many(privateMessageAttachments),
}));

export const groupChannelsRelations = relations(groupChannels, ({ one, many }) => ({
  creator: one(users, {
    fields: [groupChannels.creatorId],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(groupMessages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(groupChannels, {
    fields: [channelMembers.channelId],
    references: [groupChannels.id],
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id],
  }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one, many }) => ({
  channel: one(groupChannels, {
    fields: [groupMessages.channelId],
    references: [groupChannels.id],
  }),
  sender: one(users, {
    fields: [groupMessages.senderId],
    references: [users.id],
  }),
  attachments: many(groupMessageAttachments),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: "creator" }),
  responsibleTasks: many(tasks, { relationName: "responsible" }),
  participatingTasks: many(taskParticipants),
  comments: many(comments),
  taskHistory: many(taskHistory),
  sentMessages: many(privateMessages, { relationName: "sender" }),
  receivedMessages: many(privateMessages, { relationName: "recipient" }),
  createdChannels: many(groupChannels, { relationName: "creator" }),
  channelMemberships: many(channelMembers),
  groupMessages: many(groupMessages, { relationName: "sender" }),
  uploadedFiles: many(fileAttachments, { relationName: "uploader" }),
  emailNotifications: many(emailNotifications),
  calendarEvents: many(calendarEvents),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  creator: one(users, {
    fields: [workflows.creatorId],
    references: [users.id],
  }),
  stages: many(workflowStages),
  tasks: many(tasks),
}));

export const workflowStagesRelations = relations(workflowStages, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowStages.workflowId],
    references: [workflows.id],
  }),
  incomingTransitions: many(workflowTransitions, { relationName: "toStage" }),
  outgoingTransitions: many(workflowTransitions, { relationName: "fromStage" }),
  tasks: many(tasks),
}));

export const workflowTransitionsRelations = relations(workflowTransitions, ({ one }) => ({
  fromStage: one(workflowStages, {
    fields: [workflowTransitions.fromStageId],
    references: [workflowStages.id],
  }),
  toStage: one(workflowStages, {
    fields: [workflowTransitions.toStageId],
    references: [workflowStages.id],
  }),
}));

// File attachment relations
export const fileAttachmentsRelations = relations(fileAttachments, ({ one, many }) => ({
  uploader: one(users, {
    fields: [fileAttachments.uploaderId],
    references: [users.id],
  }),
  privateMessages: many(privateMessageAttachments),
  groupMessages: many(groupMessageAttachments),
  comments: many(commentAttachments),
}));

// PrivateMessageAttachments relations
export const privateMessageAttachmentsRelations = relations(privateMessageAttachments, ({ one }) => ({
  message: one(privateMessages, {
    fields: [privateMessageAttachments.messageId],
    references: [privateMessages.id],
  }),
  file: one(fileAttachments, {
    fields: [privateMessageAttachments.fileId],
    references: [fileAttachments.id],
  }),
}));

// GroupMessageAttachments relations
export const groupMessageAttachmentsRelations = relations(groupMessageAttachments, ({ one }) => ({
  message: one(groupMessages, {
    fields: [groupMessageAttachments.messageId],
    references: [groupMessages.id],
  }),
  file: one(fileAttachments, {
    fields: [groupMessageAttachments.fileId],
    references: [fileAttachments.id],
  }),
}));

// Comment attachments relations
export const commentAttachmentsRelations = relations(commentAttachments, ({ one }) => ({
  comment: one(comments, {
    fields: [commentAttachments.commentId],
    references: [comments.id],
  }),
  file: one(fileAttachments, {
    fields: [commentAttachments.fileId],
    references: [fileAttachments.id],
  }),
}));

// Email notifications relations
export const emailNotificationsRelations = relations(emailNotifications, ({ one }) => ({
  user: one(users, {
    fields: [emailNotifications.userId],
    references: [users.id],
  }),
}));

// Calendar events relations
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
}));

// Stock management tables
export const stockItems = pgTable("stock_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  cost: integer("cost").notNull(), // cost in cents to avoid floating point issues
  quantity: integer("quantity").notNull().default(0),
  assignedUserId: integer("assigned_user_id").references(() => users.id), // user assigned to manage this item
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Stock movements/transactions for tracking quantity changes
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stock_item_id").references(() => stockItems.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(), // who made the change
  type: text("type").notNull(), // 'add', 'remove', 'adjust'
  quantity: integer("quantity").notNull(), // positive or negative amount
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason"), // optional reason for the change
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User permissions for stock management
export const userStockPermissions = pgTable("user_stock_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  canViewStock: boolean("can_view_stock").default(false),
  canManageStock: boolean("can_manage_stock").default(false), // can add/edit items
  canAdjustQuantities: boolean("can_adjust_quantities").default(false), // can modify quantities
  grantedById: integer("granted_by_id").references(() => users.id).notNull(), // admin who granted permission
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    userUnique: unique().on(table.userId)
  };
});

// Stock relations
export const stockItemsRelations = relations(stockItems, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [stockItems.assignedUserId],
    references: [users.id],
  }),
  movements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  stockItem: one(stockItems, {
    fields: [stockMovements.stockItemId],
    references: [stockItems.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

export const userStockPermissionsRelations = relations(userStockPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userStockPermissions.userId],
    references: [users.id],
  }),
  grantedBy: one(users, {
    fields: [userStockPermissions.grantedById],
    references: [users.id],
  }),
}));




export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  notificationPreferences: true,
});

export const insertSubtaskSchema = createInsertSchema(subtasks).pick({
  title: true,
});

export const insertTaskStepSchema = createInsertSchema(taskSteps).pick({
  title: true,
  description: true,
  order: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  taskId: true,
}).extend({
  attachments: z.array(z.instanceof(File)).optional(),
});

export const insertPrivateMessageSchema = createInsertSchema(privateMessages).pick({
  content: true,
}).extend({
  recipientId: z.number(),
  attachments: z.array(z.instanceof(File)).optional(),
});

export const insertWorkflowSchema = createInsertSchema(workflows).pick({
  name: true,
  description: true,
  isDefault: true,
  metadata: true,
});

export const insertWorkflowStageSchema = createInsertSchema(workflowStages).pick({
  name: true,
  description: true,
  order: true,
  color: true,
  metadata: true,
});

export const insertWorkflowTransitionSchema = createInsertSchema(workflowTransitions).pick({
  fromStageId: true,
  toStageId: true,
  conditions: true,
});

export const insertGroupChannelSchema = createInsertSchema(groupChannels).pick({
  name: true,
  description: true,
  isPrivate: true,
});

export const insertChannelMemberSchema = createInsertSchema(channelMembers).pick({
  channelId: true,
  userId: true,
  isAdmin: true,
});

export const insertGroupMessageSchema = createInsertSchema(groupMessages).pick({
  content: true,
}).extend({
  attachments: z.array(z.instanceof(File)).optional(),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  responsibleId: true,
  priority: true,
  workflowId: true,
  stageId: true,
}).extend({
  participantIds: z.array(z.number()).optional(),
  subtasks: z.array(insertSubtaskSchema).optional(),
  steps: z.array(insertTaskStepSchema).optional(),
  dueDate: z.preprocess((arg) => {
    if (arg === null || arg === undefined || arg === '') return null;
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return null;
  }, z.date().nullable()),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type TaskStep = typeof taskSteps.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskParticipant = typeof taskParticipants.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type PrivateMessage = typeof privateMessages.$inferSelect;
export type InsertPrivateMessage = z.infer<typeof insertPrivateMessageSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowStage = typeof workflowStages.$inferSelect;
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type InsertWorkflowStage = z.infer<typeof insertWorkflowStageSchema>;
export type InsertWorkflowTransition = z.infer<typeof insertWorkflowTransitionSchema>;
export type GroupChannel = typeof groupChannels.$inferSelect;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroupChannel = z.infer<typeof insertGroupChannelSchema>;
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type InsertGroupMessage = z.infer<typeof insertGroupMessageSchema>;
export type TaskHistory = typeof taskHistory.$inferSelect;

// Task history schema
export const insertTaskHistorySchema = createInsertSchema(taskHistory).pick({
  action: true,
  oldValue: true,
  newValue: true,
  details: true,
});

export type InsertTaskHistory = z.infer<typeof insertTaskHistorySchema>;

// File attachment schemas and types
export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).pick({
  filename: true,
  originalFilename: true,
  mimeType: true,
  size: true,
  path: true,
});

export const insertPrivateMessageAttachmentSchema = createInsertSchema(privateMessageAttachments).pick({
  messageId: true,
  fileId: true,
});

export const insertGroupMessageAttachmentSchema = createInsertSchema(groupMessageAttachments).pick({
  messageId: true,
  fileId: true,
});

export const insertCommentAttachmentSchema = createInsertSchema(commentAttachments).pick({
  commentId: true,
  fileId: true,
});

export type FileAttachment = typeof fileAttachments.$inferSelect;
export type PrivateMessageAttachment = typeof privateMessageAttachments.$inferSelect;
export type GroupMessageAttachment = typeof groupMessageAttachments.$inferSelect;
export type CommentAttachment = typeof commentAttachments.$inferSelect;
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type InsertPrivateMessageAttachment = z.infer<typeof insertPrivateMessageAttachmentSchema>;
export type InsertGroupMessageAttachment = z.infer<typeof insertGroupMessageAttachmentSchema>;
export type InsertCommentAttachment = z.infer<typeof insertCommentAttachmentSchema>;

// Email notification and calendar event schemas and types
export const insertEmailNotificationSchema = createInsertSchema(emailNotifications).extend({
  recipientEmail: z.string().email().optional(),
});
// Fixed schema that matches the actual database columns

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).pick({
  userId: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  allDay: true,
  type: true,
  relatedEntityId: true,
  relatedEntityType: true,
});

export type EmailNotification = typeof emailNotifications.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertEmailNotification = z.infer<typeof insertEmailNotificationSchema>;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

// Stock management schemas and types
export const insertStockItemSchema = createInsertSchema(stockItems).pick({
  name: true,
  description: true,
  cost: true,
  quantity: true,
  assignedUserId: true,
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).pick({
  type: true,
  quantity: true,
  previousQuantity: true,
  newQuantity: true,
  reason: true,
});

export const insertUserStockPermissionSchema = createInsertSchema(userStockPermissions).pick({
  canViewStock: true,
  canManageStock: true,
  canAdjustQuantities: true,
});

export type StockItem = typeof stockItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type UserStockPermission = typeof userStockPermissions.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type InsertUserStockPermission = z.infer<typeof insertUserStockPermissionSchema>;

// Estimation management tables
export const estimations = pgTable("estimations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: timestamp("date").notNull(),
  address: text("address").notNull(),
  clientName: text("client_name").notNull(),
  clientInformation: text("client_information"),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  totalCost: integer("total_cost").default(0), // calculated field in cents
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Estimation items - linking estimations to stock items with quantities
export const estimationItems = pgTable("estimation_items", {
  id: serial("id").primaryKey(),
  estimationId: integer("estimation_id").references(() => estimations.id).notNull(),
  stockItemId: integer("stock_item_id").references(() => stockItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitCost: integer("unit_cost").notNull(), // cost per unit at time of estimation
  totalCost: integer("total_cost").notNull(), // quantity * unitCost
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    estimationItemUnique: unique().on(table.estimationId, table.stockItemId)
  };
});

// Estimation management schemas and types
export const insertEstimationSchema = createInsertSchema(estimations).pick({
  name: true,
  date: true,
  address: true,
  clientName: true,
  clientInformation: true,
}).extend({
  date: z.string().transform((str) => new Date(str)),
});

export const insertEstimationItemSchema = createInsertSchema(estimationItems).pick({
  estimationId: true,
  stockItemId: true,
  quantity: true,
  unitCost: true,
  totalCost: true,
});

export type Estimation = typeof estimations.$inferSelect;
export type EstimationItem = typeof estimationItems.$inferSelect;
export type InsertEstimation = z.infer<typeof insertEstimationSchema>;
export type InsertEstimationItem = z.infer<typeof insertEstimationItemSchema>;

// Estimation relations
export const estimationsRelations = relations(estimations, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [estimations.createdById],
    references: [users.id],
  }),
  items: many(estimationItems),
}));

export const estimationItemsRelations = relations(estimationItems, ({ one }) => ({
  estimation: one(estimations, {
    fields: [estimationItems.estimationId],
    references: [estimations.id],
  }),
  stockItem: one(stockItems, {
    fields: [estimationItems.stockItemId],
    references: [stockItems.id],
  }),
}));