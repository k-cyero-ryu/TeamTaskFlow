import { Task, InsertTask, User, InsertUser, Subtask, TaskStep, Comment, InsertComment, PrivateMessage, InsertPrivateMessage, Workflow, WorkflowStage, WorkflowTransition, InsertWorkflow, InsertWorkflowStage, InsertWorkflowTransition, GroupChannel, InsertGroupChannel, ChannelMember, InsertChannelMember, GroupMessage, InsertGroupMessage, FileAttachment, InsertFileAttachment, PrivateMessageAttachment, InsertPrivateMessageAttachment, GroupMessageAttachment, InsertGroupMessageAttachment, EmailNotification, InsertEmailNotification, CalendarEvent, InsertCalendarEvent } from "@shared/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { tasks, users, taskParticipants, subtasks, taskSteps, comments, privateMessages, workflows, workflowStages, workflowTransitions, groupChannels, channelMembers, groupMessages, fileAttachments, privateMessageAttachments, groupMessageAttachments, emailNotifications, calendarEvents } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool, db, executeWithRetry } from "./database/connection";
import { Logger } from "./utils/logger";
import { DatabaseError } from "./utils/errors";
import express from "express";
import multer from "multer";
// Include Express namespace for Multer.File type
import 'express';

// Initialize logger for storage operations
const logger = new Logger('Storage');

// Initialize PostgreSQL session store with proper error handling
const PostgresSessionStore = connectPg(session);

// Define storage interface
interface IStorage {
  sessionStore: session.Store;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  getTasks(): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask & { creatorId: number; participantIds?: number[] }): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  getSubtasks(taskId: number): Promise<Subtask[]>;
  getTaskSteps(taskId: number): Promise<TaskStep[]>;
  getTaskParticipants(taskId: number): Promise<{ username: string; id: number }[]>;
  updateSubtaskStatus(id: number, completed: boolean): Promise<void>;
  updateTaskStepStatus(id: number, completed: boolean): Promise<void>;
  getTaskComments(taskId: number): Promise<(Comment & { user: Pick<User, 'id' | 'username'> })[]>;
  createComment(comment: InsertComment & { userId: number }): Promise<Comment>;
  updateComment(id: number, content: string): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
  getPrivateMessages(userId1: number, userId2: number): Promise<(PrivateMessage & { sender: Pick<User, 'id' | 'username'> })[]>;
  getUnreadMessageCount(userId: number): Promise<number>;
  getUserConversations(userId: number): Promise<{ user: Pick<User, 'id' | 'username'>; lastMessage: PrivateMessage & { sender: Pick<User, 'id' | 'username'> } }[]>;
  createPrivateMessage(message: InsertPrivateMessage & { senderId: number }): Promise<PrivateMessage>;
  markMessagesAsRead(userId: number, otherUserId: number): Promise<void>;  
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: number): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow & { creatorId: number }): Promise<Workflow>;
  getWorkflowStages(workflowId: number): Promise<WorkflowStage[]>;
  getAllStages(): Promise<WorkflowStage[]>;
  getWorkflowStage(workflowId: number, stageId: number): Promise<WorkflowStage | undefined>;
  createWorkflowStage(stage: InsertWorkflowStage & { workflowId: number }): Promise<WorkflowStage>;
  getWorkflowTransitions(workflowId: number): Promise<WorkflowTransition[]>;
  createWorkflowTransition(transition: InsertWorkflowTransition): Promise<WorkflowTransition>;
  getTasksByWorkflowStage(workflowId: number, stageId: number): Promise<Task[]>;
  updateTaskStage(taskId: number, stageId: number): Promise<Task>;
  
  // Group chat methods
  getGroupChannels(userId: number): Promise<GroupChannel[]>;
  getGroupChannel(id: number): Promise<GroupChannel | undefined>;
  createGroupChannel(channel: InsertGroupChannel & { creatorId: number }): Promise<GroupChannel>;
  getChannelMembers(channelId: number): Promise<(ChannelMember & { user: Pick<User, 'id' | 'username'> })[]>;
  addChannelMember(channelId: number, userId: number, isAdmin?: boolean): Promise<ChannelMember>;
  removeChannelMember(channelId: number, userId: number): Promise<void>;
  getGroupMessages(channelId: number): Promise<(GroupMessage & { sender: Pick<User, 'id' | 'username'> })[]>;
  createGroupMessage(message: InsertGroupMessage & { senderId: number }): Promise<GroupMessage>;
  
  // File attachment methods
  createFileAttachment(file: InsertFileAttachment & { uploaderId: number }): Promise<FileAttachment>;
  getFileAttachment(id: number): Promise<FileAttachment | undefined>;
  getFileAttachments(fileIds: number[]): Promise<FileAttachment[]>;
  createPrivateMessageWithAttachments(
    message: InsertPrivateMessage & { senderId: number },
    files?: Express.Multer.File[]
  ): Promise<PrivateMessage>;
  createGroupMessageWithAttachments(
    message: InsertGroupMessage & { senderId: number },
    files?: Express.Multer.File[]
  ): Promise<GroupMessage>;
  getPrivateMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]>;
  getGroupMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]>;

  // Email notification methods
  createEmailNotification(notification: InsertEmailNotification): Promise<EmailNotification>;
  getEmailNotification(id: number): Promise<EmailNotification | undefined>;
  getUserEmailNotifications(userId: number): Promise<EmailNotification[]>;
  updateEmailNotification(id: number, data: Partial<EmailNotification>): Promise<EmailNotification>;
  deleteEmailNotification(id: number): Promise<void>;
  
  // Calendar event methods
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  getUserCalendarEvents(userId: number): Promise<CalendarEvent[]>;
  getCalendarEventByRelatedEntity(entityType: string, entityId: number): Promise<CalendarEvent | undefined>;
  updateCalendarEvent(id: number, data: Partial<CalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: number): Promise<void>;
  
  // User methods with email and notification preferences
  updateUserEmail(userId: number, email: string): Promise<User>;
  updateUserNotificationPreferences(userId: number, preferences: Record<string, boolean>): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session', // Explicitly set the session table name
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    });

    // Monitor session store
    this.sessionStore.on('error', (error) => {
      console.error('Session store error:', error);
    });
  }

  // User methods with improved error handling
  async getUser(id: number): Promise<User | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
      }, 'Get user by ID');
    } catch (error) {
      logger.error(`Failed to get user with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
      }, 'Get user by username');
    } catch (error) {
      logger.error(`Failed to get user with username ${username}`, { error });
      throw new DatabaseError(`Failed to get user by username: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      return await executeWithRetry(async () => {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
      }, 'Create user');
    } catch (error) {
      logger.error('Failed to create user', { error, username: insertUser.username });
      throw new DatabaseError(`Failed to create user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(users);
      }, 'Get all users');
    } catch (error) {
      logger.error('Failed to get users', { error });
      throw new DatabaseError(`Failed to get users: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTasks(): Promise<Task[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(tasks);
      }, 'Get all tasks');
    } catch (error) {
      logger.error('Failed to get tasks', { error });
      throw new DatabaseError(`Failed to get tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTask(id: number): Promise<Task | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        return task;
      }, 'Get task by ID');
    } catch (error) {
      logger.error(`Failed to get task with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createTask(task: InsertTask & { creatorId: number; participantIds?: number[] }): Promise<Task> {
    try {
      return await executeWithRetry(async (client) => {
        const { subtasks: subtaskList, steps, participantIds, ...taskData } = task;

        // Create the task
        const [newTask] = await db.insert(tasks)
          .values({
            ...taskData,
            status: "todo",
          })
          .returning();

        // Add participants if any
        if (participantIds?.length) {
          await db.insert(taskParticipants).values(
            participantIds.map(userId => ({
              taskId: newTask.id,
              userId,
            }))
          );
        }

        // Add subtasks if any
        if (subtaskList?.length) {
          await db.insert(subtasks).values(
            subtaskList.map(subtask => ({
              ...subtask,
              taskId: newTask.id,
            }))
          );
        }

        // Add steps if any
        if (steps?.length) {
          await db.insert(taskSteps).values(
            steps.map(step => ({
              ...step,
              taskId: newTask.id,
            }))
          );
        }

        return newTask;
      }, 'Create task with related entities');
    } catch (error) {
      logger.error('Failed to create task', { error });
      throw new DatabaseError(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateTaskStatus(id: number, status: string): Promise<Task> {
    try {
      return await executeWithRetry(async () => {
        const [updatedTask] = await db
          .update(tasks)
          .set({ status })
          .where(eq(tasks.id, id))
          .returning();
    
        if (!updatedTask) {
          throw new Error("Task not found");
        }
    
        return updatedTask;
      }, 'Update task status');
    } catch (error) {
      logger.error(`Failed to update task status for task ${id}`, { error });
      throw new DatabaseError(`Failed to update task status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteTask(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        // Execute in sequence to maintain referential integrity
        await db.delete(taskParticipants).where(eq(taskParticipants.taskId, id));
        await db.delete(subtasks).where(eq(subtasks.taskId, id));
        await db.delete(taskSteps).where(eq(taskSteps.taskId, id));
        // Delete comments related to this task
        await db.delete(comments).where(eq(comments.taskId, id));
        // Finally delete the task
        await db.delete(tasks).where(eq(tasks.id, id));
      }, 'Delete task with all related entities');
    } catch (error) {
      logger.error(`Failed to delete task with ID ${id}`, { error });
      throw new DatabaseError(`Failed to delete task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getSubtasks(taskId: number): Promise<Subtask[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
      }, 'Get subtasks for task');
    } catch (error) {
      logger.error(`Failed to get subtasks for task ${taskId}`, { error });
      throw new DatabaseError(`Failed to get subtasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTaskSteps(taskId: number): Promise<TaskStep[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));
      }, 'Get steps for task');
    } catch (error) {
      logger.error(`Failed to get steps for task ${taskId}`, { error });
      throw new DatabaseError(`Failed to get task steps: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTaskParticipants(taskId: number): Promise<{ username: string; id: number }[]> {
    try {
      return await executeWithRetry(async () => {
        const participants = await db
          .select({
            username: users.username,
            id: users.id,
          })
          .from(taskParticipants)
          .innerJoin(users, eq(taskParticipants.userId, users.id))
          .where(eq(taskParticipants.taskId, taskId));
    
        return participants;
      }, 'Get participants for task');
    } catch (error) {
      logger.error(`Failed to get participants for task ${taskId}`, { error });
      throw new DatabaseError(`Failed to get task participants: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateSubtaskStatus(id: number, completed: boolean): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db.update(subtasks)
          .set({ completed })
          .where(eq(subtasks.id, id));
      }, 'Update subtask status');
    } catch (error) {
      logger.error(`Failed to update subtask status for subtask ${id}`, { error });
      throw new DatabaseError(`Failed to update subtask status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateTaskStepStatus(id: number, completed: boolean): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db.update(taskSteps)
          .set({ completed })
          .where(eq(taskSteps.id, id));
      }, 'Update task step status');
    } catch (error) {
      logger.error(`Failed to update task step status for step ${id}`, { error });
      throw new DatabaseError(`Failed to update task step status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTaskComments(taskId: number): Promise<(Comment & { user: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select({
            id: comments.id,
            content: comments.content,
            taskId: comments.taskId,
            userId: comments.userId,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            user: {
              id: users.id,
              username: users.username,
            },
          })
          .from(comments)
          .innerJoin(users, eq(comments.userId, users.id))
          .where(eq(comments.taskId, taskId))
          .orderBy(comments.createdAt);
      }, 'Get comments for task');
    } catch (error) {
      logger.error(`Failed to get comments for task ${taskId}`, { error });
      throw new DatabaseError(`Failed to get task comments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createComment(comment: InsertComment & { userId: number }): Promise<Comment> {
    try {
      return await executeWithRetry(async () => {
        const [newComment] = await db
          .insert(comments)
          .values({
            content: comment.content,
            taskId: comment.taskId,
            userId: comment.userId,
          })
          .returning();
        return newComment;
      }, 'Create comment');
    } catch (error) {
      logger.error('Failed to create comment', { error, taskId: comment.taskId });
      throw new DatabaseError(`Failed to create comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateComment(id: number, content: string): Promise<Comment> {
    try {
      return await executeWithRetry(async () => {
        const [updatedComment] = await db
          .update(comments)
          .set({
            content,
            updatedAt: new Date()
          })
          .where(eq(comments.id, id))
          .returning();
        
        if (!updatedComment) {
          throw new Error("Comment not found");
        }
        
        return updatedComment;
      }, 'Update comment');
    } catch (error) {
      logger.error(`Failed to update comment with ID ${id}`, { error });
      throw new DatabaseError(`Failed to update comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteComment(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db.delete(comments).where(eq(comments.id, id));
      }, 'Delete comment');
    } catch (error) {
      logger.error(`Failed to delete comment with ID ${id}`, { error });
      throw new DatabaseError(`Failed to delete comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPrivateMessages(userId1: number, userId2: number): Promise<(PrivateMessage & { sender: Pick<User, 'id' | 'username'>; attachments?: (FileAttachment & { id: number })[] })[]> {
    try {
      return await executeWithRetry(async () => {
        const messages = await db
          .select({
            id: privateMessages.id,
            content: privateMessages.content,
            senderId: privateMessages.senderId,
            recipientId: privateMessages.recipientId,
            createdAt: privateMessages.createdAt,
            readAt: privateMessages.readAt,
            sender: {
              id: users.id,
              username: users.username,
            },
          })
          .from(privateMessages)
          .innerJoin(users, eq(privateMessages.senderId, users.id))
          .where(
            and(
              or(
                and(
                  eq(privateMessages.senderId, userId1),
                  eq(privateMessages.recipientId, userId2)
                ),
                and(
                  eq(privateMessages.senderId, userId2),
                  eq(privateMessages.recipientId, userId1)
                )
              )
            )
          )
          .orderBy(privateMessages.createdAt);
          
        // For each message, fetch its attachments
        const messagesWithAttachments = await Promise.all(
          messages.map(async (message) => {
            try {
              const attachments = await this.getPrivateMessageAttachments(message.id);
              return {
                ...message,
                attachments: attachments.length > 0 ? attachments : undefined
              };
            } catch (error) {
              logger.error(`Failed to get attachments for message ${message.id}`, { error });
              return message;
            }
          })
        );
        
        return messagesWithAttachments;
      }, 'Get private messages between users');
    } catch (error) {
      logger.error(`Failed to get private messages between users ${userId1} and ${userId2}`, { error });
      throw new DatabaseError(`Failed to get private messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    try {
      return await executeWithRetry(async () => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(privateMessages)
          .where(
            and(
              eq(privateMessages.recipientId, userId),
              sql`${privateMessages.readAt} IS NULL`
            )
          );
        return Number(result[0]?.count) || 0;
      }, 'Get unread message count');
    } catch (error) {
      logger.error(`Failed to get unread message count for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get unread message count: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUserConversations(userId: number): Promise<{ user: Pick<User, 'id' | 'username'>; lastMessage: PrivateMessage & { sender: Pick<User, 'id' | 'username'> } }[]> {
    try {
      return await executeWithRetry(async () => {
        // Get all users who have exchanged messages with the current user
        const conversations = await db
          .select({
            otherUser: {
              id: users.id,
              username: users.username,
            },
          })
          .from(privateMessages)
          .innerJoin(
            users,
            or(
              and(
                eq(privateMessages.recipientId, userId),
                eq(users.id, privateMessages.senderId)
              ),
              and(
                eq(privateMessages.senderId, userId),
                eq(users.id, privateMessages.recipientId)
              )
            )
          )
          .groupBy(users.id);

        // For each conversation, get the last message
        const results = await Promise.all(
          conversations.map(async ({ otherUser }) => {
            const [lastMessage] = await db
              .select({
                id: privateMessages.id,
                content: privateMessages.content,
                senderId: privateMessages.senderId,
                recipientId: privateMessages.recipientId,
                createdAt: privateMessages.createdAt,
                readAt: privateMessages.readAt,
                sender: {
                  id: users.id,
                  username: users.username,
                },
              })
              .from(privateMessages)
              .innerJoin(users, eq(privateMessages.senderId, users.id))
              .where(
                or(
                  and(
                    eq(privateMessages.senderId, userId),
                    eq(privateMessages.recipientId, otherUser.id)
                  ),
                  and(
                    eq(privateMessages.senderId, otherUser.id),
                    eq(privateMessages.recipientId, userId)
                  )
                )
              )
              .orderBy(desc(privateMessages.createdAt))
              .limit(1);

            return {
              user: otherUser,
              lastMessage,
            };
          })
        );

        return results;
      }, 'Get user conversations');
    } catch (error) {
      logger.error(`Failed to get conversations for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get user conversations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createPrivateMessage(message: InsertPrivateMessage & { senderId: number }): Promise<PrivateMessage> {
    try {
      return await executeWithRetry(async () => {
        const [newMessage] = await db
          .insert(privateMessages)
          .values({
            content: message.content,
            senderId: message.senderId,
            recipientId: message.recipientId,
          })
          .returning();
        return newMessage;
      }, 'Create private message');
    } catch (error) {
      logger.error('Failed to create private message', { 
        error, 
        senderId: message.senderId, 
        recipientId: message.recipientId 
      });
      throw new DatabaseError(`Failed to create private message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async markMessagesAsRead(userId: number, otherUserId: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .update(privateMessages)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(privateMessages.recipientId, userId),
              eq(privateMessages.senderId, otherUserId),
              sql`${privateMessages.readAt} IS NULL`
            )
          );
      }, 'Mark messages as read');
    } catch (error) {
      logger.error(`Failed to mark messages as read for user ${userId} from user ${otherUserId}`, { error });
      throw new DatabaseError(`Failed to mark messages as read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWorkflows(): Promise<Workflow[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(workflows);
      }, 'Get all workflows');
    } catch (error) {
      logger.error('Failed to get workflows', { error });
      throw new DatabaseError(`Failed to get workflows: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWorkflow(id: number): Promise<Workflow | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
        return workflow;
      }, 'Get workflow by ID');
    } catch (error) {
      logger.error(`Failed to get workflow with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createWorkflow(workflow: InsertWorkflow & { creatorId: number }): Promise<Workflow> {
    try {
      return await executeWithRetry(async () => {
        const [newWorkflow] = await db
          .insert(workflows)
          .values(workflow)
          .returning();
        return newWorkflow;
      }, 'Create workflow');
    } catch (error) {
      logger.error('Failed to create workflow', { error, name: workflow.name });
      throw new DatabaseError(`Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWorkflowStages(workflowId: number): Promise<WorkflowStage[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select()
          .from(workflowStages)
          .where(eq(workflowStages.workflowId, workflowId))
          .orderBy(workflowStages.order);
      }, 'Get workflow stages');
    } catch (error) {
      logger.error(`Failed to get stages for workflow ${workflowId}`, { error });
      throw new DatabaseError(`Failed to get workflow stages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAllStages(): Promise<WorkflowStage[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select()
          .from(workflowStages)
          .orderBy(workflowStages.workflowId, workflowStages.order);
      }, 'Get all workflow stages');
    } catch (error) {
      logger.error('Failed to get all workflow stages', { error });
      throw new DatabaseError(`Failed to get workflow stages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWorkflowStage(workflowId: number, stageId: number): Promise<WorkflowStage | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [stage] = await db
          .select()
          .from(workflowStages)
          .where(
            and(
              eq(workflowStages.workflowId, workflowId),
              eq(workflowStages.id, stageId)
            )
          );
        return stage;
      }, 'Get workflow stage');
    } catch (error) {
      logger.error(`Failed to get workflow stage (workflowId: ${workflowId}, stageId: ${stageId})`, { error });
      throw new DatabaseError(`Failed to get workflow stage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createWorkflowStage(stage: InsertWorkflowStage & { workflowId: number }): Promise<WorkflowStage> {
    try {
      return await executeWithRetry(async () => {
        const [newStage] = await db
          .insert(workflowStages)
          .values(stage)
          .returning();
        return newStage;
      }, 'Create workflow stage');
    } catch (error) {
      logger.error('Failed to create workflow stage', { error, workflowId: stage.workflowId });
      throw new DatabaseError(`Failed to create workflow stage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWorkflowTransitions(workflowId: number): Promise<WorkflowTransition[]> {
    try {
      return await executeWithRetry(async () => {
        const stages = await this.getWorkflowStages(workflowId);
        const stageIds = stages.map(s => s.id);

        return await db
          .select()
          .from(workflowTransitions)
          .where(
            or(
              inArray(workflowTransitions.fromStageId, stageIds),
              inArray(workflowTransitions.toStageId, stageIds)
            )
          );
      }, 'Get workflow transitions');
    } catch (error) {
      logger.error(`Failed to get transitions for workflow ${workflowId}`, { error });
      throw new DatabaseError(`Failed to get workflow transitions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createWorkflowTransition(transition: InsertWorkflowTransition): Promise<WorkflowTransition> {
    try {
      return await executeWithRetry(async () => {
        const [newTransition] = await db
          .insert(workflowTransitions)
          .values(transition)
          .returning();
        return newTransition;
      }, 'Create workflow transition');
    } catch (error) {
      logger.error('Failed to create workflow transition', { 
        error, 
        fromStageId: transition.fromStageId,
        toStageId: transition.toStageId
      });
      throw new DatabaseError(`Failed to create workflow transition: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTasksByWorkflowStage(workflowId: number, stageId: number): Promise<Task[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.workflowId, workflowId),
              eq(tasks.stageId, stageId)
            )
          );
      }, 'Get tasks by workflow stage');
    } catch (error) {
      logger.error(`Failed to get tasks for workflow ${workflowId} and stage ${stageId}`, { error });
      throw new DatabaseError(`Failed to get tasks by workflow stage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateTaskStage(taskId: number, stageId: number): Promise<Task> {
    try {
      return await executeWithRetry(async () => {
        const [updatedTask] = await db
          .update(tasks)
          .set({ stageId })
          .where(eq(tasks.id, taskId))
          .returning();

        if (!updatedTask) {
          throw new Error("Task not found");
        }

        return updatedTask;
      }, 'Update task stage');
    } catch (error) {
      logger.error(`Failed to update stage for task ${taskId}`, { error, stageId });
      throw new DatabaseError(`Failed to update task stage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Group chat methods
  async getGroupChannels(userId: number): Promise<GroupChannel[]> {
    try {
      return await executeWithRetry(async () => {
        // Get all channels where the user is a member
        const userChannels = await db
          .select({
            channelId: channelMembers.channelId,
          })
          .from(channelMembers)
          .where(eq(channelMembers.userId, userId));

        const userChannelIds = userChannels.map(channel => channel.channelId);
        
        // Get all public channels
        const allChannels = await db
          .select()
          .from(groupChannels)
          .orderBy(groupChannels.createdAt);
        
        // Filter to get:
        // 1. All public channels
        // 2. Private channels where the user is a member
        return allChannels.filter(channel => 
          !channel.isPrivate || // Public channels
          userChannelIds.includes(channel.id) // Private channels where user is a member
        );
      }, 'Get group channels for user');
    } catch (error) {
      logger.error(`Failed to get group channels for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get group channels: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getGroupChannel(id: number): Promise<GroupChannel | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [channel] = await db.select().from(groupChannels).where(eq(groupChannels.id, id));
        return channel;
      }, 'Get group channel by ID');
    } catch (error) {
      logger.error(`Failed to get group channel with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get group channel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createGroupChannel(channel: InsertGroupChannel & { creatorId: number }): Promise<GroupChannel> {
    try {
      return await executeWithRetry(async (client) => {
        // Create the channel
        const [newChannel] = await db.insert(groupChannels)
          .values({
            name: channel.name,
            description: channel.description,
            creatorId: channel.creatorId,
            isPrivate: channel.isPrivate ?? false,
            createdAt: new Date(),
          })
          .returning();

        // Add the creator as an admin member
        await db.insert(channelMembers)
          .values({
            channelId: newChannel.id,
            userId: channel.creatorId,
            isAdmin: true,
            joinedAt: new Date(),
          });

        return newChannel;
      }, 'Create group channel with creator as admin');
    } catch (error) {
      logger.error('Failed to create group channel', { error, creatorId: channel.creatorId });
      throw new DatabaseError(`Failed to create group channel: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getChannelMembers(channelId: number): Promise<(ChannelMember & { user: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select({
            id: channelMembers.id,
            channelId: channelMembers.channelId,
            userId: channelMembers.userId,
            isAdmin: channelMembers.isAdmin,
            joinedAt: channelMembers.joinedAt,
            user: {
              id: users.id,
              username: users.username,
            },
          })
          .from(channelMembers)
          .innerJoin(users, eq(channelMembers.userId, users.id))
          .where(eq(channelMembers.channelId, channelId))
          .orderBy(channelMembers.joinedAt);
      }, 'Get channel members');
    } catch (error) {
      logger.error(`Failed to get members for channel ${channelId}`, { error });
      throw new DatabaseError(`Failed to get channel members: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addChannelMember(channelId: number, userId: number, isAdmin: boolean = false): Promise<ChannelMember> {
    try {
      return await executeWithRetry(async () => {
        // Check if the user is already a member
        const existingMember = await db
          .select()
          .from(channelMembers)
          .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));

        if (existingMember.length > 0) {
          // If user is already a member, update admin status if needed
          if (existingMember[0].isAdmin !== isAdmin) {
            const [updatedMember] = await db
              .update(channelMembers)
              .set({ isAdmin })
              .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
              .returning();
            return updatedMember;
          }
          return existingMember[0];
        }

        // Add the user as a member
        const [newMember] = await db
          .insert(channelMembers)
          .values({
            channelId,
            userId,
            isAdmin,
            joinedAt: new Date(),
          })
          .returning();
        return newMember;
      }, 'Add member to channel');
    } catch (error) {
      logger.error(`Failed to add user ${userId} to channel ${channelId}`, { error });
      throw new DatabaseError(`Failed to add channel member: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async removeChannelMember(channelId: number, userId: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .delete(channelMembers)
          .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
      }, 'Remove member from channel');
    } catch (error) {
      logger.error(`Failed to remove user ${userId} from channel ${channelId}`, { error });
      throw new DatabaseError(`Failed to remove channel member: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getGroupMessages(channelId: number): Promise<(GroupMessage & { sender: Pick<User, 'id' | 'username'>; attachments?: (FileAttachment & { id: number })[] })[]> {
    try {
      return await executeWithRetry(async () => {
        const messages = await db
          .select({
            id: groupMessages.id,
            content: groupMessages.content,
            channelId: groupMessages.channelId,
            senderId: groupMessages.senderId,
            createdAt: groupMessages.createdAt,
            updatedAt: groupMessages.updatedAt,
            sender: {
              id: users.id,
              username: users.username,
            },
          })
          .from(groupMessages)
          .innerJoin(users, eq(groupMessages.senderId, users.id))
          .where(eq(groupMessages.channelId, channelId))
          .orderBy(groupMessages.createdAt);
        
        // For each message, fetch its attachments
        const messagesWithAttachments = await Promise.all(
          messages.map(async (message) => {
            try {
              const attachments = await this.getGroupMessageAttachments(message.id);
              return {
                ...message,
                attachments: attachments.length > 0 ? attachments : undefined
              };
            } catch (error) {
              logger.error(`Failed to get attachments for group message ${message.id}`, { error });
              return message;
            }
          })
        );
        
        return messagesWithAttachments;
      }, 'Get group messages for channel');
    } catch (error) {
      logger.error(`Failed to get messages for channel ${channelId}`, { error });
      throw new DatabaseError(`Failed to get group messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createGroupMessage(message: InsertGroupMessage & { senderId: number }): Promise<GroupMessage> {
    try {
      return await executeWithRetry(async () => {
        const [newMessage] = await db
          .insert(groupMessages)
          .values({
            content: message.content,
            channelId: message.channelId,
            senderId: message.senderId,
            createdAt: new Date(),
          })
          .returning();
        return newMessage;
      }, 'Create group message');
    } catch (error) {
      logger.error('Failed to create group message', { error, channelId: message.channelId });
      throw new DatabaseError(`Failed to create group message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // File attachment methods
  async createFileAttachment(file: InsertFileAttachment & { uploaderId: number }): Promise<FileAttachment> {
    try {
      return await executeWithRetry(async () => {
        const [newFile] = await db
          .insert(fileAttachments)
          .values({
            filename: file.filename,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            size: file.size,
            path: file.path,
            uploaderId: file.uploaderId,
          })
          .returning();
        return newFile;
      }, 'Create file attachment');
    } catch (error) {
      logger.error('Failed to create file attachment', { error, filename: file.originalFilename });
      throw new DatabaseError(`Failed to create file attachment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFileAttachment(id: number): Promise<FileAttachment | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [file] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id));
        return file;
      }, 'Get file attachment by ID');
    } catch (error) {
      logger.error(`Failed to get file attachment with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get file attachment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFileAttachments(fileIds: number[]): Promise<FileAttachment[]> {
    try {
      return await executeWithRetry(async () => {
        if (fileIds.length === 0) return [];
        return await db.select().from(fileAttachments).where(inArray(fileAttachments.id, fileIds));
      }, 'Get file attachments by IDs');
    } catch (error) {
      logger.error(`Failed to get file attachments with IDs ${fileIds.join(', ')}`, { error });
      throw new DatabaseError(`Failed to get file attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createPrivateMessageWithAttachments(
    message: InsertPrivateMessage & { senderId: number },
    files?: Express.Multer.File[]
  ): Promise<PrivateMessage> {
    try {
      return await executeWithRetry(async () => {
        // First, create the message
        const [newMessage] = await db
          .insert(privateMessages)
          .values({
            content: message.content,
            senderId: message.senderId,
            recipientId: message.recipientId,
          })
          .returning();

        // If there are files, create file attachments and link them to the message
        if (files && files.length > 0) {
          const fileAttachmentRecords = await Promise.all(
            files.map(async (file) => {
              const [fileRecord] = await db
                .insert(fileAttachments)
                .values({
                  filename: file.filename,
                  originalFilename: file.originalname,
                  mimeType: file.mimetype,
                  size: file.size,
                  path: file.path,
                  uploaderId: message.senderId,
                })
                .returning();
              return fileRecord;
            })
          );

          // Create message attachment records
          await db.insert(privateMessageAttachments).values(
            fileAttachmentRecords.map((file) => ({
              messageId: newMessage.id,
              fileId: file.id,
            }))
          );
        }

        return newMessage;
      }, 'Create private message with attachments');
    } catch (error) {
      logger.error('Failed to create private message with attachments', { error });
      throw new DatabaseError(`Failed to create private message with attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createGroupMessageWithAttachments(
    message: InsertGroupMessage & { senderId: number },
    files?: Express.Multer.File[]
  ): Promise<GroupMessage> {
    try {
      return await executeWithRetry(async () => {
        // First, create the message
        const [newMessage] = await db
          .insert(groupMessages)
          .values({
            content: message.content,
            channelId: message.channelId,
            senderId: message.senderId,
          })
          .returning();

        // If there are files, create file attachments and link them to the message
        if (files && files.length > 0) {
          const fileAttachmentRecords = await Promise.all(
            files.map(async (file) => {
              const [fileRecord] = await db
                .insert(fileAttachments)
                .values({
                  filename: file.filename,
                  originalFilename: file.originalname,
                  mimeType: file.mimetype,
                  size: file.size,
                  path: file.path,
                  uploaderId: message.senderId,
                })
                .returning();
              return fileRecord;
            })
          );

          // Create message attachment records
          await db.insert(groupMessageAttachments).values(
            fileAttachmentRecords.map((file) => ({
              messageId: newMessage.id,
              fileId: file.id,
            }))
          );
        }

        return newMessage;
      }, 'Create group message with attachments');
    } catch (error) {
      logger.error('Failed to create group message with attachments', { error });
      throw new DatabaseError(`Failed to create group message with attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPrivateMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]> {
    try {
      return await executeWithRetry(async () => {
        const attachments = await db
          .select({
            id: fileAttachments.id,
            filename: fileAttachments.filename,
            originalFilename: fileAttachments.originalFilename,
            mimeType: fileAttachments.mimeType,
            size: fileAttachments.size,
            path: fileAttachments.path,
            uploaderId: fileAttachments.uploaderId,
            createdAt: fileAttachments.createdAt,
          })
          .from(privateMessageAttachments)
          .innerJoin(
            fileAttachments,
            eq(privateMessageAttachments.fileId, fileAttachments.id)
          )
          .where(eq(privateMessageAttachments.messageId, messageId));
        
        return attachments;
      }, 'Get attachments for private message');
    } catch (error) {
      logger.error(`Failed to get attachments for private message ${messageId}`, { error });
      throw new DatabaseError(`Failed to get private message attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getGroupMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]> {
    try {
      return await executeWithRetry(async () => {
        const attachments = await db
          .select({
            id: fileAttachments.id,
            filename: fileAttachments.filename,
            originalFilename: fileAttachments.originalFilename,
            mimeType: fileAttachments.mimeType,
            size: fileAttachments.size,
            path: fileAttachments.path,
            uploaderId: fileAttachments.uploaderId,
            createdAt: fileAttachments.createdAt,
          })
          .from(groupMessageAttachments)
          .innerJoin(
            fileAttachments,
            eq(groupMessageAttachments.fileId, fileAttachments.id)
          )
          .where(eq(groupMessageAttachments.messageId, messageId));
        
        return attachments;
      }, 'Get attachments for group message');
    } catch (error) {
      logger.error(`Failed to get attachments for group message ${messageId}`, { error });
      throw new DatabaseError(`Failed to get group message attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Email notification methods
  async createEmailNotification(notification: InsertEmailNotification): Promise<EmailNotification> {
    try {
      return await executeWithRetry(async () => {
        const [newNotification] = await db
          .insert(emailNotifications)
          .values(notification)
          .returning();
        return newNotification;
      }, 'Create email notification');
    } catch (error) {
      logger.error('Failed to create email notification', { error });
      throw new DatabaseError(`Failed to create email notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getEmailNotification(id: number): Promise<EmailNotification | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [notification] = await db
          .select()
          .from(emailNotifications)
          .where(eq(emailNotifications.id, id));
        return notification;
      }, 'Get email notification by ID');
    } catch (error) {
      logger.error(`Failed to get email notification with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get email notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUserEmailNotifications(userId: number): Promise<EmailNotification[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select()
          .from(emailNotifications)
          .where(eq(emailNotifications.userId, userId))
          .orderBy(desc(emailNotifications.createdAt));
      }, 'Get user email notifications');
    } catch (error) {
      logger.error(`Failed to get email notifications for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get user email notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateEmailNotification(id: number, data: Partial<EmailNotification>): Promise<EmailNotification> {
    try {
      return await executeWithRetry(async () => {
        const [updatedNotification] = await db
          .update(emailNotifications)
          .set(data)
          .where(eq(emailNotifications.id, id))
          .returning();
        
        if (!updatedNotification) {
          throw new Error('Email notification not found');
        }
        
        return updatedNotification;
      }, 'Update email notification');
    } catch (error) {
      logger.error(`Failed to update email notification with ID ${id}`, { error });
      throw new DatabaseError(`Failed to update email notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteEmailNotification(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .delete(emailNotifications)
          .where(eq(emailNotifications.id, id));
      }, 'Delete email notification');
    } catch (error) {
      logger.error(`Failed to delete email notification with ID ${id}`, { error });
      throw new DatabaseError(`Failed to delete email notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Calendar event methods
  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    try {
      return await executeWithRetry(async () => {
        const [newEvent] = await db
          .insert(calendarEvents)
          .values(event)
          .returning();
        return newEvent;
      }, 'Create calendar event');
    } catch (error) {
      logger.error('Failed to create calendar event', { error });
      throw new DatabaseError(`Failed to create calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [event] = await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.id, id));
        return event;
      }, 'Get calendar event by ID');
    } catch (error) {
      logger.error(`Failed to get calendar event with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUserCalendarEvents(userId: number): Promise<CalendarEvent[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.userId, userId))
          .orderBy(calendarEvents.startTime);
      }, 'Get user calendar events');
    } catch (error) {
      logger.error(`Failed to get calendar events for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get user calendar events: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCalendarEventByRelatedEntity(entityType: string, entityId: number): Promise<CalendarEvent | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [event] = await db
          .select()
          .from(calendarEvents)
          .where(
            and(
              eq(calendarEvents.relatedEntityType, entityType),
              eq(calendarEvents.relatedEntityId, entityId)
            )
          );
        return event;
      }, 'Get calendar event by related entity');
    } catch (error) {
      logger.error(`Failed to get calendar event for entity ${entityType} with ID ${entityId}`, { error });
      throw new DatabaseError(`Failed to get calendar event by related entity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCalendarEvent(id: number, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      return await executeWithRetry(async () => {
        const [updatedEvent] = await db
          .update(calendarEvents)
          .set(data)
          .where(eq(calendarEvents.id, id))
          .returning();
        
        if (!updatedEvent) {
          throw new Error('Calendar event not found');
        }
        
        return updatedEvent;
      }, 'Update calendar event');
    } catch (error) {
      logger.error(`Failed to update calendar event with ID ${id}`, { error });
      throw new DatabaseError(`Failed to update calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .delete(calendarEvents)
          .where(eq(calendarEvents.id, id));
      }, 'Delete calendar event');
    } catch (error) {
      logger.error(`Failed to delete calendar event with ID ${id}`, { error });
      throw new DatabaseError(`Failed to delete calendar event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // User methods with email and notification preferences
  async updateUserEmail(userId: number, email: string): Promise<User> {
    try {
      return await executeWithRetry(async () => {
        const [updatedUser] = await db
          .update(users)
          .set({ email })
          .where(eq(users.id, userId))
          .returning();
        
        if (!updatedUser) {
          throw new Error('User not found');
        }
        
        return updatedUser;
      }, 'Update user email');
    } catch (error) {
      logger.error(`Failed to update email for user ${userId}`, { error });
      throw new DatabaseError(`Failed to update user email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateUserNotificationPreferences(userId: number, preferences: Record<string, boolean>): Promise<User> {
    try {
      return await executeWithRetry(async () => {
        const [updatedUser] = await db
          .update(users)
          .set({ notificationPreferences: preferences })
          .where(eq(users.id, userId))
          .returning();
        
        if (!updatedUser) {
          throw new Error('User not found');
        }
        
        return updatedUser;
      }, 'Update user notification preferences');
    } catch (error) {
      logger.error(`Failed to update notification preferences for user ${userId}`, { error });
      throw new DatabaseError(`Failed to update user notification preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const storage = new DatabaseStorage();