import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  responsibleId: integer("responsible_id").references(() => users.id),
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

// Add new comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Add private messages table
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

// Add comments relation to users
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

// Add private messages relations
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

// Update user relations to include messages
export const usersRelations = relations(users, ({ many }) => ({
  createdTasks: many(tasks, { relationName: "creator" }),
  responsibleTasks: many(tasks, { relationName: "responsible" }),
  participatingTasks: many(taskParticipants),
  comments: many(comments),
  sentMessages: many(privateMessages, { relationName: "sender" }),
  receivedMessages: many(privateMessages, { relationName: "recipient" }),
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

// Add comment schemas
export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  taskId: true,
});

// Add message schemas
export const insertPrivateMessageSchema = createInsertSchema(privateMessages).pick({
  content: true,
  recipientId: true,
});

// Update the insertTaskSchema to properly handle dates
export const insertTaskSchema = createInsertSchema(tasks).pick({
  title: true,
  description: true,
  responsibleId: true,
  priority: true,
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
// Add comment types
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
// Add message types
export type PrivateMessage = typeof privateMessages.$inferSelect;
export type InsertPrivateMessage = z.infer<typeof insertPrivateMessageSchema>;