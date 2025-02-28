import { pgTable, text, serial, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Existing tables remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

export const privateMessages = pgTable("private_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
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

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const privateMessagesRelations = relations(privateMessages, ({ one }) => ({
  sender: one(users, {
    fields: [privateMessages.senderId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [privateMessages.recipientId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: "creator" }),
  responsibleTasks: many(tasks, { relationName: "responsible" }),
  participatingTasks: many(taskParticipants),
  comments: many(comments),
  sentMessages: many(privateMessages, { relationName: "sender" }),
  receivedMessages: many(privateMessages, { relationName: "recipient" }),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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
});

export const insertPrivateMessageSchema = createInsertSchema(privateMessages).pick({
  content: true,
}).extend({
  recipientId: z.number(),
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