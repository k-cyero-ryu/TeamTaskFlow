import { Task, InsertTask, User, InsertUser, Subtask, TaskStep, Comment, InsertComment, PrivateMessage, InsertPrivateMessage, Workflow, WorkflowStage, WorkflowTransition, InsertWorkflow, InsertWorkflowStage, InsertWorkflowTransition, GroupChannel, InsertGroupChannel, ChannelMember, InsertChannelMember, GroupMessage, InsertGroupMessage, FileAttachment, InsertFileAttachment, PrivateMessageAttachment, InsertPrivateMessageAttachment, GroupMessageAttachment, InsertGroupMessageAttachment, CommentAttachment, InsertCommentAttachment, EmailNotification, InsertEmailNotification, CalendarEvent, InsertCalendarEvent, TaskHistory, InsertTaskHistory, StockItem, InsertStockItem, StockMovement, InsertStockMovement, UserStockPermission, InsertUserStockPermission, Estimation, InsertEstimation, EstimationItem, InsertEstimationItem, Company, InsertCompany, Proforma, InsertProforma, ProformaItem, UserProformaPermission, InsertUserProformaPermission, Expense, InsertExpense, ExpenseReceipt, InsertExpenseReceipt, UserExpensePermissions, InsertUserExpensePermissions, UserClientPermissions, InsertUserClientPermissions } from "@shared/schema";
import { eq, and, or, desc, inArray, sql, isNotNull } from "drizzle-orm";
import { tasks, users, taskParticipants, subtasks, taskSteps, comments, privateMessages, workflows, workflowStages, workflowTransitions, groupChannels, channelMembers, groupMessages, fileAttachments, privateMessageAttachments, groupMessageAttachments, commentAttachments, emailNotifications, calendarEvents, taskHistory, stockItems, stockMovements, userStockPermissions, estimations, estimationItems, companies, proformas, proformaItems, userProformaPermissions, expenses, expenseReceipts, userExpensePermissions, userClientPermissions, clients, services, clientServices } from "@shared/schema";
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
  getTasksForUser(userId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask & { creatorId: number; participantIds?: number[] }): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask> & { participantIds?: number[] }): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task>;
  updateTaskDueDate(id: number, dueDate: Date | null): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  getSubtasks(taskId: number): Promise<Subtask[]>;
  getTaskSteps(taskId: number): Promise<TaskStep[]>;
  getTaskParticipants(taskId: number): Promise<{ username: string; id: number }[]>;
  updateSubtaskStatus(id: number, completed: boolean): Promise<void>;
  updateTaskStepStatus(id: number, completed: boolean): Promise<void>;
  getTaskComments(taskId: number): Promise<(Comment & { user: Pick<User, 'id' | 'username'>, attachments?: FileAttachment[] })[]>;
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
  updateGroupChannel(id: number, updates: Partial<Pick<InsertGroupChannel, 'name' | 'description' | 'isPrivate'>>): Promise<GroupChannel>;
  getChannelMembers(channelId: number): Promise<(ChannelMember & { user: Pick<User, 'id' | 'username'> })[]>;
  addChannelMember(channelId: number, userId: number, isAdmin?: boolean): Promise<ChannelMember>;
  removeChannelMember(channelId: number, userId: number): Promise<void>;
  getGroupMessages(channelId: number): Promise<(GroupMessage & { sender: Pick<User, 'id' | 'username'> })[]>;
  createGroupMessage(message: InsertGroupMessage & { senderId: number; channelId: number }): Promise<GroupMessage>;

  // File attachment methods
  createFileAttachment(file: InsertFileAttachment & { uploaderId: number }): Promise<FileAttachment>;
  getFileAttachment(id: number): Promise<FileAttachment | undefined>;
  getFileAttachments(fileIds: number[]): Promise<FileAttachment[]>;
  createPrivateMessageWithAttachments(
    message: InsertPrivateMessage & { senderId: number },
    files?: Express.Multer.File[]
  ): Promise<PrivateMessage>;
  createGroupMessageWithAttachments(
    message: InsertGroupMessage & { senderId: number; channelId: number },
    files?: Express.Multer.File[]
  ): Promise<GroupMessage>;
  getPrivateMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]>;
  getGroupMessageAttachments(messageId: number): Promise<(FileAttachment & { id: number })[]>;

  // Comment with attachments methods
  createCommentWithAttachments(
    comment: InsertComment & { userId: number },
    files?: Express.Multer.File[]
  ): Promise<Comment>;
  getCommentAttachments(commentId: number): Promise<(FileAttachment & { id: number })[]>;

  // Email notification methods
  createEmailNotification(notification: InsertEmailNotification): Promise<EmailNotification>;
  getEmailNotification(id: number): Promise<EmailNotification | undefined>;
  getUserEmailNotifications(userId: number): Promise<EmailNotification[]>;
  updateEmailNotification(id: number, data: Partial<EmailNotification>): Promise<EmailNotification>;
  deleteEmailNotification(id: number): Promise<void>;
  markNotificationAsRead(id: number): Promise<EmailNotification>;
  markNotificationAsUnread(id: number): Promise<EmailNotification>;
  markAllNotificationsAsRead(userId: number): Promise<{ updatedCount: number }>;

  // Calendar event methods
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  getUserCalendarEvents(userId: number): Promise<CalendarEvent[]>;
  getCalendarEventByRelatedEntity(entityType: string, entityId: number): Promise<CalendarEvent | undefined>;
  updateCalendarEvent(id: number, data: Partial<CalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: number): Promise<void>;

  // User methods with email and notification preferences
  updateUserEmail(userId: number, email: string | undefined): Promise<User>;
  updateUserUsername(userId: number, username: string): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;
  updateUserNotificationPreferences(userId: number, preferences: Record<string, boolean>): Promise<User>;

  // Task history methods
  getTaskHistory(taskId: number): Promise<(TaskHistory & { user: Pick<User, 'id' | 'username'> })[]>;
  createTaskHistoryEntry(entry: InsertTaskHistory & { taskId: number; userId: number }): Promise<TaskHistory>;

  // Stock management methods
  getStockItems(): Promise<(StockItem & { assignedUser?: Pick<User, 'id' | 'username'> })[]>;
  getStockItem(id: number): Promise<(StockItem & { assignedUser?: Pick<User, 'id' | 'username'> }) | undefined>;
  createStockItem(item: InsertStockItem): Promise<StockItem>;
  updateStockItem(id: number, data: Partial<InsertStockItem>): Promise<StockItem>;
  deleteStockItem(id: number): Promise<void>;
  adjustStockQuantity(itemId: number, userId: number, newQuantity: number, reason?: string): Promise<StockItem>;
  getStockMovements(itemId: number): Promise<(StockMovement & { user: Pick<User, 'id' | 'username'> })[]>;
  assignAllStockItems(userId: number | null): Promise<void>;

  // Stock permissions methods
  getUserStockPermissions(userId: number): Promise<UserStockPermission | undefined>;
  setUserStockPermissions(userId: number, permissions: InsertUserStockPermission, grantedById: number): Promise<UserStockPermission>;
  getUsersWithStockAccess(): Promise<(User & { stockPermissions?: UserStockPermission })[]>;

  // Estimation methods
  getEstimations(): Promise<(Estimation & { createdBy: Pick<User, 'id' | 'username'>; items: (EstimationItem & { stockItem: Pick<StockItem, 'id' | 'name' | 'cost'> })[] })[]>;
  getEstimation(id: number): Promise<(Estimation & { createdBy: Pick<User, 'id' | 'username'>; items: (EstimationItem & { stockItem: Pick<StockItem, 'id' | 'name' | 'cost'> })[] }) | undefined>;
  createEstimation(estimation: InsertEstimation, userId: number): Promise<Estimation>;
  updateEstimation(id: number, estimation: Partial<InsertEstimation>): Promise<Estimation>;
  deleteEstimation(id: number): Promise<void>;
  addEstimationItem(estimationId: number, stockItemId: number, quantity: number): Promise<EstimationItem>;
  updateEstimationItem(id: number, quantity: number): Promise<EstimationItem>;
  deleteEstimationItem(id: number): Promise<void>;

  // Company methods
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  getDefaultCompany(): Promise<Company | undefined>;
  clearDefaultCompany(): Promise<void>;

  // Proforma methods
  getProformas(): Promise<(Proforma & { estimation: Pick<Estimation, 'id' | 'name' | 'clientName'>; createdBy: Pick<User, 'id' | 'username'>; items: (ProformaItem & { stockItem: Pick<StockItem, 'id' | 'name'> })[] })[]>;
  getProforma(id: number): Promise<(Proforma & { estimation: Pick<Estimation, 'id' | 'name' | 'clientName' | 'clientInformation' | 'address'>; createdBy: Pick<User, 'id' | 'username'>; items: (ProformaItem & { stockItem: Pick<StockItem, 'id' | 'name'> })[] }) | undefined>;
  createProforma(proforma: InsertProforma, userId: number): Promise<Proforma>;
  updateProforma(id: number, proforma: Partial<InsertProforma>): Promise<Proforma>;
  deleteProforma(id: number): Promise<void>;
  generateProformaNumber(): Promise<string>;

  // Proforma permissions methods
  getUserProformaPermissions(userId: number): Promise<UserProformaPermission | undefined>;
  getUsersWithProformaAccess(): Promise<Array<{ id: number; username: string; proformaPermissions?: UserProformaPermission; }>>;
  setUserProformaPermissions(userId: number, permissions: InsertUserProformaPermission, grantedById: number): Promise<UserProformaPermission>;

  // Expense methods
  getExpenses(): Promise<(Expense & { createdBy: Pick<User, 'id' | 'username'>; receipts: (ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[] })[]>;
  getExpense(id: number): Promise<(Expense & { createdBy: Pick<User, 'id' | 'username'>; receipts: (ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[] }) | undefined>;
  createExpense(expense: InsertExpense, userId: number): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;
  markExpenseAsPaid(id: number): Promise<Expense>;

  // Expense receipt methods
  getExpenseReceipts(expenseId: number): Promise<(ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[]>;
  uploadExpenseReceipt(receipt: InsertExpenseReceipt, userId: number): Promise<ExpenseReceipt>;
  deleteExpenseReceipt(id: number): Promise<void>;

  // Expense permissions methods
  getUserExpensePermissions(userId: number): Promise<UserExpensePermissions | undefined>;
  getUsersWithExpenseAccess(): Promise<Array<{ id: number; username: string; expensePermissions?: UserExpensePermissions; }>>;
  setUserExpensePermissions(userId: number, permissions: InsertUserExpensePermissions, grantedById: number): Promise<UserExpensePermissions>;

  // Client permissions methods
  getUserClientPermissions(userId: number): Promise<UserClientPermissions | undefined>;
  getUsersWithClientAccess(): Promise<Array<{ id: number; username: string; clientPermissions?: UserClientPermissions; }>>;
  setUserClientPermissions(userId: number, permissions: InsertUserClientPermissions, grantedById: number): Promise<UserClientPermissions>;
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

  async getTasksForUser(userId: number): Promise<Task[]> {
    try {
      return await executeWithRetry(async () => {
        // Admin users (ID 1) can see all tasks
        if (userId === 1) {
          return await db.select().from(tasks);
        }

        // Get tasks where the user is:
        // 1. Creator
        // 2. Responsible person
        // 3. Participant
        const userTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            status: tasks.status,
            priority: tasks.priority,
            dueDate: tasks.dueDate,
            createdAt: tasks.createdAt,
            creatorId: tasks.creatorId,
            responsibleId: tasks.responsibleId,
            workflowId: tasks.workflowId,
            stageId: tasks.stageId,
          })
          .from(tasks)
          .leftJoin(taskParticipants, eq(tasks.id, taskParticipants.taskId))
          .where(
            or(
              eq(tasks.creatorId, userId),           // User is creator
              eq(tasks.responsibleId, userId),       // User is responsible
              eq(taskParticipants.userId, userId)    // User is participant
            )
          )
          .groupBy(tasks.id); // Group by task ID to avoid duplicates

        return userTasks;
      }, 'Get tasks for user');
    } catch (error) {
      logger.error('Failed to get tasks for user', { error, userId });
      throw new DatabaseError(`Failed to get tasks for user: ${error instanceof Error ? error.message : String(error)}`);
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
        const { subtasks: subtaskList, steps, participantIds, creatorId, ...taskData } = task;

        // Create the task
        const [newTask] = await db.insert(tasks)
          .values({
            ...taskData,
            creatorId,
          })
          .returning();

        // Add participants if any
        if (participantIds?.length) {
          try {
            logger.info('Adding participants to task', {
              taskId: newTask.id,
              participantIds
            });

            // Make sure all participantIds are valid numbers
            const validParticipantIds = participantIds
              .filter(id => typeof id === 'number' && !isNaN(id) && id > 0)
              .map(id => parseInt(String(id), 10)); // Ensure they're all integers

            await db.insert(taskParticipants).values(
              validParticipantIds.map(userId => ({
                taskId: newTask.id,
                userId,
              }))
            );

            logger.info('Successfully added participants to task', {
              taskId: newTask.id,
              count: validParticipantIds.length
            });
          } catch (participantError) {
            // Log but don't fail the whole task creation
            logger.error('Failed to add participants to task', {
              taskId: newTask.id,
              error: participantError
            });
          }
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

        // Create history entry for task creation
        await this.createTaskHistoryEntry({
          taskId: newTask.id,
          userId: creatorId,
          action: 'created',
          details: `Task "${newTask.title}" was created`,
        });

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
        // Get current task to track old status
        const currentTask = await this.getTask(id);
        if (!currentTask) {
          throw new Error("Task not found");
        }

        const [updatedTask] = await db
          .update(tasks)
          .set({ status })
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new Error("Task not found");
        }

        // Create history entry for status change
        if (currentTask.status !== status) {
          await this.createTaskHistoryEntry({
            taskId: id,
            userId: updatedTask.creatorId, // Use creator as default, will be overridden in API route
            action: 'status_changed',
            oldValue: currentTask.status,
            newValue: status,
          });
        }

        return updatedTask;
      }, 'Update task status');
    } catch (error) {
      logger.error(`Failed to update task status for task ${id}`, { error });
      throw new DatabaseError(`Failed to update task status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateTaskDueDate(id: number, dueDate: Date | null): Promise<Task> {
    try {
      return await executeWithRetry(async () => {
        // Get current task to track old due date
        const currentTask = await this.getTask(id);
        if (!currentTask) {
          throw new Error("Task not found");
        }

        const [updatedTask] = await db
          .update(tasks)
          .set({ dueDate })
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new Error("Task not found");
        }

        // Create history entry for due date change
        const oldDate = currentTask.dueDate?.toISOString() || null;
        const newDate = dueDate?.toISOString() || null;

        if (oldDate !== newDate) {
          await this.createTaskHistoryEntry({
            taskId: id,
            userId: updatedTask.creatorId, // Use creator as default, will be overridden in API route
            action: 'due_date_changed',
            oldValue: oldDate,
            newValue: newDate,
          });
        }

        return updatedTask;
      }, 'Update task due date');
    } catch (error) {
      logger.error(`Failed to update task due date for task ${id}`, { error });
      throw new DatabaseError(`Failed to update task due date: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateTask(id: number, updates: Partial<InsertTask> & { participantIds?: number[] }): Promise<Task> {
    try {
      return await executeWithRetry(async () => {
        const { subtasks: subtaskList, steps, participantIds, ...taskUpdates } = updates;

        // Get current task for history tracking
        const currentTask = await this.getTask(id);
        if (!currentTask) {
          throw new Error("Task not found");
        }

        // Update the main task fields
        const [updatedTask] = await db
          .update(tasks)
          .set(taskUpdates)
          .where(eq(tasks.id, id))
          .returning();

        if (!updatedTask) {
          throw new Error("Task not found");
        }

        // Update participants if provided
        if (participantIds !== undefined) {
          // Remove existing participants
          await db.delete(taskParticipants).where(eq(taskParticipants.taskId, id));

          // Add new participants
          if (participantIds.length > 0) {
            const validParticipantIds = participantIds
              .filter(userId => typeof userId === 'number' && !isNaN(userId) && userId > 0)
              .map(userId => parseInt(String(userId), 10));

            if (validParticipantIds.length > 0) {
              await db.insert(taskParticipants).values(
                validParticipantIds.map(userId => ({
                  taskId: id,
                  userId,
                }))
              );
            }
          }
        }

        // Update subtasks if provided
        if (subtaskList !== undefined) {
          // Remove existing subtasks
          await db.delete(subtasks).where(eq(subtasks.taskId, id));

          // Add new subtasks
          if (subtaskList.length > 0) {
            await db.insert(subtasks).values(
              subtaskList.map(subtask => ({
                ...subtask,
                taskId: id,
              }))
            );
          }
        }

        // Update steps if provided
        if (steps !== undefined) {
          // Remove existing steps
          await db.delete(taskSteps).where(eq(taskSteps.taskId, id));

          // Add new steps
          if (steps.length > 0) {
            await db.insert(taskSteps).values(
              steps.map(step => ({
                ...step,
                taskId: id,
              }))
            );
          }
        }

        // Create history entry for the update
        const changedFields = [];
        if (taskUpdates.title && taskUpdates.title !== currentTask.title) {
          changedFields.push(`title from "${currentTask.title}" to "${taskUpdates.title}"`);
        }
        if (taskUpdates.description !== undefined && taskUpdates.description !== currentTask.description) {
          changedFields.push(`description`);
        }
        if (taskUpdates.priority && taskUpdates.priority !== currentTask.priority) {
          changedFields.push(`priority from "${currentTask.priority}" to "${taskUpdates.priority}"`);
        }
        if (taskUpdates.dueDate !== undefined) {
          const oldDate = currentTask.dueDate ? new Date(currentTask.dueDate).toDateString() : 'none';
          const newDate = taskUpdates.dueDate ? new Date(taskUpdates.dueDate).toDateString() : 'none';
          if (oldDate !== newDate) {
            changedFields.push(`due date from ${oldDate} to ${newDate}`);
          }
        }

        if (changedFields.length > 0 || participantIds !== undefined || subtaskList !== undefined || steps !== undefined) {
          await this.createTaskHistoryEntry({
            taskId: id,
            userId: updatedTask.creatorId, // Use creator as default, will be overridden in API route
            action: 'updated',
            details: `Task updated: ${changedFields.join(', ')}${participantIds !== undefined ? ', participants updated' : ''}${subtaskList !== undefined ? ', subtasks updated' : ''}${steps !== undefined ? ', steps updated' : ''}`,
          });
        }

        return updatedTask;
      }, 'Update task');
    } catch (error) {
      logger.error(`Failed to update task ${id}`, { error });
      throw new DatabaseError(`Failed to update task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteTask(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        // Execute in sequence to maintain referential integrity
        // Delete all related entities first
        await db.delete(taskParticipants).where(eq(taskParticipants.taskId, id));
        await db.delete(subtasks).where(eq(subtasks.taskId, id));
        await db.delete(taskSteps).where(eq(taskSteps.taskId, id));

        // Delete comment attachments first, then comments
        const taskComments = await db.select({ id: comments.id }).from(comments).where(eq(comments.taskId, id));
        for (const comment of taskComments) {
          await db.delete(commentAttachments).where(eq(commentAttachments.commentId, comment.id));
        }
        await db.delete(comments).where(eq(comments.taskId, id));

        // Delete task history records
        await db.delete(taskHistory).where(eq(taskHistory.taskId, id));

        // Delete any calendar events related to this task
        await db.delete(calendarEvents).where(
          and(
            eq(calendarEvents.relatedEntityType, 'task'),
            eq(calendarEvents.relatedEntityId, id)
          )
        );

        // Delete any email notifications related to this task
        await db.delete(emailNotifications).where(
          and(
            eq(emailNotifications.relatedEntityType, 'task'),
            eq(emailNotifications.relatedEntityId, id)
          )
        );

        // Finally delete the task itself
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

  async getTaskComments(taskId: number): Promise<(Comment & { user: Pick<User, 'id' | 'username'>, attachments?: FileAttachment[] })[]> {
    try {
      return await executeWithRetry(async () => {
        // Get comments with user information
        const commentsWithUsers = await db
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

        // Get attachments for each comment
        const commentsWithAttachments = await Promise.all(
          commentsWithUsers.map(async (comment) => {
            try {
              const attachments = await this.getCommentAttachments(comment.id);
              return {
                ...comment,
                attachments: attachments.length > 0 ? attachments : undefined
              };
            } catch (error) {
              logger.error(`Failed to get attachments for comment ${comment.id}`, { error });
              return comment;
            }
          })
        );

        return commentsWithAttachments;
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

  async updateGroupChannel(id: number, updates: Partial<Pick<InsertGroupChannel, 'name' | 'description' | 'isPrivate'>>): Promise<GroupChannel> {
    try {
      return await executeWithRetry(async () => {
        const [updatedChannel] = await db
          .update(groupChannels)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(groupChannels.id, id))
          .returning();

        if (!updatedChannel) {
          throw new Error(`Group channel with ID ${id} not found`);
        }

        return updatedChannel;
      }, 'Update group channel');
    } catch (error) {
      logger.error(`Failed to update group channel with ID ${id}`, { error });
      throw new DatabaseError(`Failed to update group channel: ${error instanceof Error ? error.message : String(error)}`);
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

  async createGroupMessage(message: InsertGroupMessage & { senderId: number; channelId: number }): Promise<GroupMessage> {
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
    message: InsertGroupMessage & { senderId: number; channelId: number },
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

  // Comment attachment methods
  async createCommentWithAttachments(
    comment: InsertComment & { userId: number },
    files?: Express.Multer.File[]
  ): Promise<Comment> {
    try {
      return await executeWithRetry(async () => {
        // First, create the comment
        const [newComment] = await db
          .insert(comments)
          .values({
            content: comment.content,
            taskId: comment.taskId,
            userId: comment.userId,
          })
          .returning();

        // If there are files, process and attach them
        if (files && files.length > 0) {
          const fileInserts = files.map(file => ({
            filename: file.filename!,
            originalFilename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path,
            uploaderId: comment.userId,
          }));

          const createdFiles = await db
            .insert(fileAttachments)
            .values(fileInserts)
            .returning();

          // Create comment-attachment associations
          const attachmentInserts = createdFiles.map(file => ({
            commentId: newComment.id,
            fileId: file.id,
          }));

          await db.insert(commentAttachments).values(attachmentInserts);
        }

        return newComment;
      }, 'Create comment with attachments');
    } catch (error) {
      logger.error('Failed to create comment with attachments', { error, commentId: comment.taskId });
      throw new DatabaseError(`Failed to create comment with attachments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCommentAttachments(commentId: number): Promise<(FileAttachment & { id: number })[]> {
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
          .from(commentAttachments)
          .innerJoin(
            fileAttachments,
            eq(commentAttachments.fileId, fileAttachments.id)
          )
          .where(eq(commentAttachments.commentId, commentId));

        return attachments;
      }, 'Get attachments for comment');
    } catch (error) {
      logger.error(`Failed to get attachments for comment ${commentId}`, { error });
      throw new DatabaseError(`Failed to get comment attachments: ${error instanceof Error ? error.message : String(error)}`);
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
          .orderBy(
            // Sort unread first (false comes before true), then by creation date descending
            emailNotifications.isRead,
            desc(emailNotifications.createdAt)
          );
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

  async markNotificationAsRead(id: number): Promise<EmailNotification> {
    try {
      return await executeWithRetry(async () => {
        const [updatedNotification] = await db
          .update(emailNotifications)
          .set({
            isRead: true,
            readAt: new Date()
          })
          .where(eq(emailNotifications.id, id))
          .returning();

        if (!updatedNotification) {
          throw new Error(`Email notification with ID ${id} not found`);
        }

        return updatedNotification;
      }, 'Mark notification as read');
    } catch (error) {
      logger.error(`Failed to mark notification as read with ID ${id}`, { error });
      throw new DatabaseError(`Failed to mark notification as read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async markNotificationAsUnread(id: number): Promise<EmailNotification> {
    try {
      return await executeWithRetry(async () => {
        const [updatedNotification] = await db
          .update(emailNotifications)
          .set({
            isRead: false,
            readAt: null
          })
          .where(eq(emailNotifications.id, id))
          .returning();

        if (!updatedNotification) {
          throw new Error(`Email notification with ID ${id} not found`);
        }

        return updatedNotification;
      }, 'Mark notification as unread');
    } catch (error) {
      logger.error(`Failed to mark notification as unread with ID ${id}`, { error });
      throw new DatabaseError(`Failed to mark notification as unread: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async markAllNotificationsAsRead(userId: number): Promise<{ updatedCount: number }> {
    try {
      return await executeWithRetry(async () => {
        const result = await db
          .update(emailNotifications)
          .set({
            isRead: true,
            readAt: new Date()
          })
          .where(and(
            eq(emailNotifications.userId, userId),
            eq(emailNotifications.isRead, false)
          ))
          .returning({ id: emailNotifications.id });

        return { updatedCount: result.length };
      }, 'Mark all notifications as read');
    } catch (error) {
      logger.error(`Failed to mark all notifications as read for user ${userId}`, { error });
      throw new DatabaseError(`Failed to mark all notifications as read: ${error instanceof Error ? error.message : String(error)}`);
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
  async updateUserEmail(userId: number, email: string | undefined): Promise<User> {
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

  async updateUserUsername(userId: number, username: string): Promise<User> {
    try {
      return await executeWithRetry(async () => {
        const [updatedUser] = await db
          .update(users)
          .set({ username })
          .where(eq(users.id, userId))
          .returning();

        if (!updatedUser) {
          throw new Error('User not found');
        }

        return updatedUser;
      }, 'Update user username');
    } catch (error) {
      logger.error(`Failed to update username for user ${userId}`, { error });
      throw new DatabaseError(`Failed to update user username: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User> {
    try {
      return await executeWithRetry(async () => {
        // Import crypto functions for password hashing
        const { scrypt, randomBytes } = await import('crypto');
        const { promisify } = await import('util');
        const scryptAsync = promisify(scrypt);

        // Hash the new password
        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
        const hashedPassword = `${buf.toString("hex")}.${salt}`;

        const [updatedUser] = await db
          .update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, userId))
          .returning();

        if (!updatedUser) {
          throw new Error('User not found');
        }

        return updatedUser;
      }, 'Update user password');
    } catch (error) {
      logger.error(`Failed to update password for user ${userId}`, { error });
      throw new DatabaseError(`Failed to update user password: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Task history methods
  async getTaskHistory(taskId: number): Promise<(TaskHistory & { user: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        const history = await db
          .select({
            id: taskHistory.id,
            taskId: taskHistory.taskId,
            userId: taskHistory.userId,
            action: taskHistory.action,
            oldValue: taskHistory.oldValue,
            newValue: taskHistory.newValue,
            details: taskHistory.details,
            createdAt: taskHistory.createdAt,
            user: {
              id: users.id,
              username: users.username,
            },
          })
          .from(taskHistory)
          .innerJoin(users, eq(taskHistory.userId, users.id))
          .where(eq(taskHistory.taskId, taskId))
          .orderBy(desc(taskHistory.createdAt));

        return history;
      }, 'Get task history');
    } catch (error) {
      logger.error(`Failed to get history for task ${taskId}`, { error });
      throw new DatabaseError(`Failed to get task history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createTaskHistoryEntry(entry: InsertTaskHistory & { taskId: number; userId: number }): Promise<TaskHistory> {
    try {
      return await executeWithRetry(async () => {
        const [newEntry] = await db
          .insert(taskHistory)
          .values({
            taskId: entry.taskId,
            userId: entry.userId,
            action: entry.action,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            details: entry.details,
            createdAt: new Date(),
          })
          .returning();

        return newEntry;
      }, 'Create task history entry');
    } catch (error) {
      logger.error('Failed to create task history entry', { error, taskId: entry.taskId });
      throw new DatabaseError(`Failed to create task history entry: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Stock management methods
  async getStockItems(): Promise<(StockItem & { assignedUser?: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        const items = await db
          .select({
            id: stockItems.id,
            name: stockItems.name,
            description: stockItems.description,
            cost: stockItems.cost,
            quantity: stockItems.quantity,
            assignedUserId: stockItems.assignedUserId,
            createdAt: stockItems.createdAt,
            updatedAt: stockItems.updatedAt,
            assignedUser: {
              id: users.id,
              username: users.username,
            },
          })
          .from(stockItems)
          .leftJoin(users, eq(stockItems.assignedUserId, users.id))
          .orderBy(stockItems.name);

        return items.map(item => ({
          ...item,
          assignedUser: item.assignedUser?.id ? item.assignedUser : undefined,
        }));
      }, 'Get all stock items');
    } catch (error) {
      logger.error('Failed to get stock items', { error });
      throw new DatabaseError(`Failed to get stock items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStockItem(id: number): Promise<(StockItem & { assignedUser?: Pick<User, 'id' | 'username'> }) | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [item] = await db
          .select({
            id: stockItems.id,
            name: stockItems.name,
            description: stockItems.description,
            cost: stockItems.cost,
            quantity: stockItems.quantity,
            assignedUserId: stockItems.assignedUserId,
            createdAt: stockItems.createdAt,
            updatedAt: stockItems.updatedAt,
            assignedUser: {
              id: users.id,
              username: users.username,
            },
          })
          .from(stockItems)
          .leftJoin(users, eq(stockItems.assignedUserId, users.id))
          .where(eq(stockItems.id, id));

        if (!item) return undefined;

        return {
          ...item,
          assignedUser: item.assignedUser.id ? item.assignedUser : undefined,
        };
      }, 'Get stock item by ID');
    } catch (error) {
      logger.error(`Failed to get stock item with ID ${id}`, { error });
      throw new DatabaseError(`Failed to get stock item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createStockItem(item: InsertStockItem): Promise<StockItem> {
    try {
      return await executeWithRetry(async () => {
        const [newItem] = await db
          .insert(stockItems)
          .values({
            ...item,
            createdAt: new Date(),
          })
          .returning();

        return newItem;
      }, 'Create stock item');
    } catch (error) {
      logger.error('Failed to create stock item', { error, itemName: item.name });
      throw new DatabaseError(`Failed to create stock item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateStockItem(id: number, data: Partial<InsertStockItem>): Promise<StockItem> {
    try {
      return await executeWithRetry(async () => {
        const [updatedItem] = await db
          .update(stockItems)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, id))
          .returning();

        if (!updatedItem) {
          throw new Error('Stock item not found');
        }

        return updatedItem;
      }, 'Update stock item');
    } catch (error) {
      logger.error(`Failed to update stock item with ID ${id}`, { error });
      throw new DatabaseError(`Failed to update stock item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteStockItem(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .delete(stockItems)
          .where(eq(stockItems.id, id));
      }, 'Delete stock item');
    } catch (error) {
      logger.error(`Failed to delete stock item with ID ${id}`, { error });
      throw new DatabaseError(`Failed to delete stock item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async adjustStockQuantity(itemId: number, userId: number, newQuantity: number, reason?: string): Promise<StockItem> {
    try {
      return await executeWithRetry(async () => {
        // Get current item to record the previous quantity
        const currentItem = await this.getStockItem(itemId);
        if (!currentItem) {
          throw new Error('Stock item not found');
        }

        // Update the quantity
        const [updatedItem] = await db
          .update(stockItems)
          .set({
            quantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(stockItems.id, itemId))
          .returning();

        if (!updatedItem) {
          throw new Error('Failed to update stock item');
        }

        // Record the movement
        await db
          .insert(stockMovements)
          .values({
            stockItemId: itemId,
            userId,
            type: newQuantity > currentItem.quantity ? 'add' : newQuantity < currentItem.quantity ? 'remove' : 'adjust',
            quantity: newQuantity - currentItem.quantity,
            previousQuantity: currentItem.quantity,
            newQuantity,
            reason,
            createdAt: new Date(),
          });

        return updatedItem;
      }, 'Adjust stock quantity');
    } catch (error) {
      logger.error(`Failed to adjust quantity for stock item ${itemId}`, { error });
      throw new DatabaseError(`Failed to adjust stock quantity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getStockMovements(itemId: number): Promise<(StockMovement & { user: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        const movements = await db
          .select({
            id: stockMovements.id,
            stockItemId: stockMovements.stockItemId,
            userId: stockMovements.userId,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            previousQuantity: stockMovements.previousQuantity,
            newQuantity: stockMovements.newQuantity,
            reason: stockMovements.reason,
            createdAt: stockMovements.createdAt,
            user: {
              id: users.id,
              username: users.username,
            },
          })
          .from(stockMovements)
          .innerJoin(users, eq(stockMovements.userId, users.id))
          .where(eq(stockMovements.stockItemId, itemId))
          .orderBy(desc(stockMovements.createdAt));

        return movements;
      }, 'Get stock movements');
    } catch (error) {
      logger.error(`Failed to get movements for stock item ${itemId}`, { error });
      throw new DatabaseError(`Failed to get stock movements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUserStockPermissions(userId: number): Promise<UserStockPermission | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [permissions] = await db
          .select()
          .from(userStockPermissions)
          .where(eq(userStockPermissions.userId, userId));

        return permissions;
      }, 'Get user stock permissions');
    } catch (error) {
      logger.error(`Failed to get stock permissions for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get user stock permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setUserStockPermissions(userId: number, permissions: InsertUserStockPermission, grantedById: number): Promise<UserStockPermission> {
    try {
      return await executeWithRetry(async () => {
        // Delete existing permissions for this user
        await db
          .delete(userStockPermissions)
          .where(eq(userStockPermissions.userId, userId));

        // Insert new permissions
        const [newPermissions] = await db
          .insert(userStockPermissions)
          .values({
            userId,
            grantedById,
            ...permissions,
            createdAt: new Date(),
          })
          .returning();

        return newPermissions;
      }, 'Set user stock permissions');
    } catch (error) {
      logger.error(`Failed to set stock permissions for user ${userId}`, { error });
      throw new DatabaseError(`Failed to set user stock permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUsersWithStockAccess(): Promise<(User & { stockPermissions?: UserStockPermission })[]> {
    try {
      return await executeWithRetry(async () => {
        const allUsers = await db
          .select({
            id: users.id,
            username: users.username,
            password: users.password,
            email: users.email,
            notificationPreferences: users.notificationPreferences,
            stockPermissions: {
              id: userStockPermissions.id,
              userId: userStockPermissions.userId,
              canViewStock: userStockPermissions.canViewStock,
              canManageStock: userStockPermissions.canManageStock,
              canAdjustQuantities: userStockPermissions.canAdjustQuantities,
              grantedById: userStockPermissions.grantedById,
              createdAt: userStockPermissions.createdAt,
            },
          })
          .from(users)
          .leftJoin(userStockPermissions, eq(users.id, userStockPermissions.userId))
          .orderBy(users.username);

        return allUsers.map(user => ({
          ...user,
          stockPermissions: user.stockPermissions?.id ? user.stockPermissions : undefined,
        }));
      }, 'Get users with stock access');
    } catch (error) {
      logger.error('Failed to get users with stock access', { error });
      throw new DatabaseError(`Failed to get users with stock access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async assignAllStockItems(userId: number | null): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .update(stockItems)
          .set({
            assignedUserId: userId,
            updatedAt: new Date(),
          });
      }, 'Assign all stock items');
    } catch (error) {
      logger.error(`Failed to assign all stock items to user ${userId}`, { error });
      throw new DatabaseError(`Failed to assign all stock items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Estimation methods implementation
  async getEstimations(): Promise<(Estimation & { createdBy: Pick<User, 'id' | 'username'>; technique?: Pick<User, 'id' | 'username'>; items: (EstimationItem & { stockItem: Pick<StockItem, 'id' | 'name' | 'cost'> })[] })[]> {
    try {
      return await executeWithRetry(async () => {
        const estimationsData = await db
          .select({
            id: estimations.id,
            name: estimations.name,
            date: estimations.date,
            address: estimations.address,
            clientName: estimations.clientName,
            clientInformation: estimations.clientInformation,
            techniqueId: estimations.techniqueId,
            createdById: estimations.createdById,
            totalCost: estimations.totalCost,
            createdAt: estimations.createdAt,
            updatedAt: estimations.updatedAt,
            createdBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(estimations)
          .innerJoin(users, eq(estimations.createdById, users.id))
          .orderBy(desc(estimations.createdAt));

        // Get items and technique info for each estimation
        const estimationsWithItems = await Promise.all(
          estimationsData.map(async (estimation) => {
            const items = await db
              .select({
                id: estimationItems.id,
                estimationId: estimationItems.estimationId,
                stockItemId: estimationItems.stockItemId,
                quantity: estimationItems.quantity,
                unitCost: estimationItems.unitCost,
                totalCost: estimationItems.totalCost,
                createdAt: estimationItems.createdAt,
                stockItem: {
                  id: stockItems.id,
                  name: stockItems.name,
                  cost: stockItems.cost,
                },
              })
              .from(estimationItems)
              .innerJoin(stockItems, eq(estimationItems.stockItemId, stockItems.id))
              .where(eq(estimationItems.estimationId, estimation.id));

            // Get technique user if exists
            let technique: Pick<User, 'id' | 'username'> | undefined;
            if (estimation.techniqueId) {
              const techniqueUser = await db
                .select({
                  id: users.id,
                  username: users.username,
                })
                .from(users)
                .where(eq(users.id, estimation.techniqueId))
                .limit(1);

              if (techniqueUser.length > 0) {
                technique = techniqueUser[0];
              }
            }

            return {
              ...estimation,
              items,
              technique,
            };
          })
        );

        return estimationsWithItems;
      }, 'Get estimations');
    } catch (error) {
      logger.error('Failed to get estimations', { error });
      throw new DatabaseError(`Failed to get estimations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getEstimation(id: number): Promise<(Estimation & { createdBy: Pick<User, 'id' | 'username'>; items: (EstimationItem & { stockItem: Pick<StockItem, 'id' | 'name' | 'cost'> })[] }) | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [estimation] = await db
          .select({
            id: estimations.id,
            name: estimations.name,
            date: estimations.date,
            address: estimations.address,
            clientName: estimations.clientName,
            clientInformation: estimations.clientInformation,
            techniqueId: estimations.techniqueId,
            createdById: estimations.createdById,
            totalCost: estimations.totalCost,
            createdAt: estimations.createdAt,
            updatedAt: estimations.updatedAt,
            createdBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(estimations)
          .innerJoin(users, eq(estimations.createdById, users.id))
          .where(eq(estimations.id, id));

        if (!estimation) return undefined;

        const items = await db
          .select({
            id: estimationItems.id,
            estimationId: estimationItems.estimationId,
            stockItemId: estimationItems.stockItemId,
            quantity: estimationItems.quantity,
            unitCost: estimationItems.unitCost,
            totalCost: estimationItems.totalCost,
            createdAt: estimationItems.createdAt,
            stockItem: {
              id: stockItems.id,
              name: stockItems.name,
              cost: stockItems.cost,
            },
          })
          .from(estimationItems)
          .innerJoin(stockItems, eq(estimationItems.stockItemId, stockItems.id))
          .where(eq(estimationItems.estimationId, estimation.id));

        return {
          ...estimation,
          items,
        };
      }, 'Get estimation');
    } catch (error) {
      logger.error(`Failed to get estimation ${id}`, { error });
      throw new DatabaseError(`Failed to get estimation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createEstimation(estimation: InsertEstimation, userId: number): Promise<Estimation> {
    try {
      return await executeWithRetry(async () => {
        const [newEstimation] = await db
          .insert(estimations)
          .values({
            ...estimation,
            createdById: userId,
          })
          .returning();

        return newEstimation;
      }, 'Create estimation');
    } catch (error) {
      logger.error('Failed to create estimation', { error });
      throw new DatabaseError(`Failed to create estimation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateEstimation(id: number, estimation: Partial<InsertEstimation>): Promise<Estimation> {
    try {
      return await executeWithRetry(async () => {
        const [updatedEstimation] = await db
          .update(estimations)
          .set({
            ...estimation,
            updatedAt: new Date(),
          })
          .where(eq(estimations.id, id))
          .returning();

        return updatedEstimation;
      }, 'Update estimation');
    } catch (error) {
      logger.error(`Failed to update estimation ${id}`, { error });
      throw new DatabaseError(`Failed to update estimation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteEstimation(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        // First delete all estimation items
        await db
          .delete(estimationItems)
          .where(eq(estimationItems.estimationId, id));

        // Then delete the estimation
        await db
          .delete(estimations)
          .where(eq(estimations.id, id));
      }, 'Delete estimation');
    } catch (error) {
      logger.error(`Failed to delete estimation ${id}`, { error });
      throw new DatabaseError(`Failed to delete estimation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addEstimationItem(estimationId: number, stockItemId: number, quantity: number): Promise<EstimationItem> {
    try {
      return await executeWithRetry(async () => {
        // Get the current cost of the stock item
        const [stockItem] = await db
          .select({ cost: stockItems.cost })
          .from(stockItems)
          .where(eq(stockItems.id, stockItemId));

        if (!stockItem) {
          throw new Error('Stock item not found');
        }

        const unitCost = stockItem.cost;
        const totalCost = unitCost * quantity;

        const [newItem] = await db
          .insert(estimationItems)
          .values({
            estimationId,
            stockItemId,
            quantity,
            unitCost,
            totalCost,
          })
          .returning();

        // Update the estimation total cost
        await this.updateEstimationTotalCost(estimationId);

        return newItem;
      }, 'Add estimation item');
    } catch (error) {
      logger.error('Failed to add estimation item', { error });
      throw new DatabaseError(`Failed to add estimation item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateEstimationItem(id: number, quantity: number): Promise<EstimationItem> {
    try {
      return await executeWithRetry(async () => {
        // Get the current item to get unit cost and estimation ID
        const [currentItem] = await db
          .select({
            unitCost: estimationItems.unitCost,
            estimationId: estimationItems.estimationId,
          })
          .from(estimationItems)
          .where(eq(estimationItems.id, id));

        if (!currentItem) {
          throw new Error('Estimation item not found');
        }

        const totalCost = currentItem.unitCost * quantity;

        const [updatedItem] = await db
          .update(estimationItems)
          .set({
            quantity,
            totalCost,
          })
          .where(eq(estimationItems.id, id))
          .returning();

        // Update the estimation total cost
        await this.updateEstimationTotalCost(currentItem.estimationId);

        return updatedItem;
      }, 'Update estimation item');
    } catch (error) {
      logger.error(`Failed to update estimation item ${id}`, { error });
      throw new DatabaseError(`Failed to update estimation item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteEstimationItem(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        // Get the estimation ID before deleting
        const [item] = await db
          .select({ estimationId: estimationItems.estimationId })
          .from(estimationItems)
          .where(eq(estimationItems.id, id));

        if (!item) {
          throw new Error('Estimation item not found');
        }

        await db
          .delete(estimationItems)
          .where(eq(estimationItems.id, id));

        // Update the estimation total cost
        await this.updateEstimationTotalCost(item.estimationId);
      }, 'Delete estimation item');
    } catch (error) {
      logger.error(`Failed to delete estimation item ${id}`, { error });
      throw new DatabaseError(`Failed to delete estimation item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateEstimationTotalCost(estimationId: number): Promise<void> {
    try {
      // Calculate the total cost from all items
      const result = await db
        .select({
          totalCost: sql<number>`COALESCE(SUM(${estimationItems.totalCost}), 0)`,
        })
        .from(estimationItems)
        .where(eq(estimationItems.estimationId, estimationId));

      const totalCost = result[0]?.totalCost || 0;

      // Update the estimation total cost
      await db
        .update(estimations)
        .set({
          totalCost,
          updatedAt: new Date(),
        })
        .where(eq(estimations.id, estimationId));
    } catch (error) {
      logger.error(`Failed to update estimation total cost for estimation ${estimationId}`, { error });
      throw new DatabaseError(`Failed to update estimation total cost: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Proforma methods implementation
  async getProformas(): Promise<any[]> {
    try {
      return await executeWithRetry(async () => {
        const proformasData = await db
          .select()
          .from(proformas)
          .innerJoin(estimations, eq(proformas.estimationId, estimations.id))
          .innerJoin(users, eq(proformas.createdById, users.id))
          .leftJoin(companies, eq(proformas.companyId, companies.id))
          .orderBy(desc(proformas.createdAt));

        // Get items for each proforma
        const proformasWithItems = await Promise.all(
          proformasData.map(async (row) => {
            const items = await db
              .select()
              .from(proformaItems)
              .innerJoin(stockItems, eq(proformaItems.stockItemId, stockItems.id))
              .where(eq(proformaItems.proformaId, row.proformas.id));

            return {
              ...row.proformas,
              estimation: {
                id: row.estimations.id,
                name: row.estimations.name,
                clientName: row.estimations.clientName,
              },
              createdBy: {
                id: row.users.id,
                username: row.users.username,
              },
              company: row.companies ? {
                id: row.companies.id,
                name: row.companies.name,
                logo: row.companies.logo,
              } : null,
              items: items.map(itemRow => ({
                ...itemRow.proforma_items,
                stockItem: {
                  id: itemRow.stock_items.id,
                  name: itemRow.stock_items.name,
                }
              })),
            };
          })
        );

        return proformasWithItems;
      }, 'Get proformas');
    } catch (error) {
      logger.error('Failed to get proformas', { error });
      throw new DatabaseError(`Failed to get proformas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProforma(id: number): Promise<(Proforma & { estimation: Pick<Estimation, 'id' | 'name' | 'clientName' | 'clientInformation' | 'address'>; createdBy: Pick<User, 'id' | 'username'>; items: (ProformaItem & { stockItem: Pick<StockItem, 'id' | 'name'> })[] }) | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [proformaData] = await db
          .select({
            id: proformas.id,
            estimationId: proformas.estimationId,
            companyId: proformas.companyId,
            proformaNumber: proformas.proformaNumber,
            profitPercentage: proformas.profitPercentage,
            totalCost: proformas.totalCost,
            totalPrice: proformas.totalPrice,
            companyName: proformas.companyName,
            companyAddress: proformas.companyAddress,
            companyPhone: proformas.companyPhone,
            companyEmail: proformas.companyEmail,
            companyLogo: proformas.companyLogo,
            status: proformas.status,
            notes: proformas.notes,
            validUntil: proformas.validUntil,
            createdById: proformas.createdById,
            createdAt: proformas.createdAt,
            updatedAt: proformas.updatedAt,
            estimation: {
              id: estimations.id,
              name: estimations.name,
              clientName: estimations.clientName,
              clientInformation: estimations.clientInformation,
              address: estimations.address,
            },
            createdBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(proformas)
          .innerJoin(estimations, eq(proformas.estimationId, estimations.id))
          .innerJoin(users, eq(proformas.createdById, users.id))
          .where(eq(proformas.id, id));

        if (!proformaData) {
          return undefined;
        }

        // Get items for the proforma
        const items = await db
          .select({
            id: proformaItems.id,
            proformaId: proformaItems.proformaId,
            estimationItemId: proformaItems.estimationItemId,
            stockItemId: proformaItems.stockItemId,
            stockItemName: proformaItems.stockItemName,
            quantity: proformaItems.quantity,
            unitCost: proformaItems.unitCost,
            unitPrice: proformaItems.unitPrice,
            totalPrice: proformaItems.totalPrice,
            createdAt: proformaItems.createdAt,
            stockItem: {
              id: stockItems.id,
              name: stockItems.name,
            },
          })
          .from(proformaItems)
          .innerJoin(stockItems, eq(proformaItems.stockItemId, stockItems.id))
          .where(eq(proformaItems.proformaId, id));

        return {
          ...proformaData,
          items,
        };
      }, 'Get proforma');
    } catch (error) {
      logger.error(`Failed to get proforma ${id}`, { error });
      throw new DatabaseError(`Failed to get proforma: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createProforma(proforma: InsertProforma, userId: number): Promise<Proforma> {
    try {
      return await executeWithRetry(async () => {
        // Get estimation with items
        const estimation = await this.getEstimation(proforma.estimationId);
        if (!estimation) {
          throw new Error('Estimation not found');
        }

        // Get company information from database
        const company = await this.getCompany(proforma.companyId);
        if (!company) {
          throw new Error('Company not found');
        }

        // Ensure totalCost is not null
        const totalCost = estimation.totalCost || 0;

        // Generate proforma number
        const proformaNumber = await this.generateProformaNumber();

        // Calculate total price based on profit percentage
        const totalPrice = Math.round(totalCost * (1 + proforma.profitPercentage / 100));

        // Create the proforma using company data from database
        const [newProforma] = await db
          .insert(proformas)
          .values({
            estimationId: proforma.estimationId,
            companyId: proforma.companyId,
            profitPercentage: proforma.profitPercentage,
            companyName: company.name,
            companyAddress: company.address,
            companyPhone: company.phone,
            companyEmail: company.email,
            companyLogo: company.logo,
            notes: proforma.notes,
            validUntil: proforma.validUntil,
            proformaNumber,
            totalCost,
            totalPrice,
            createdById: userId,
          })
          .returning();

        // Create proforma items based on estimation items
        const proformaItemsData = estimation.items.map(item => {
          const unitPrice = Math.round(item.unitCost * (1 + proforma.profitPercentage / 100));
          return {
            proformaId: newProforma.id,
            estimationItemId: item.id,
            stockItemId: item.stockItemId,
            stockItemName: item.stockItem.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitPrice,
            totalPrice: unitPrice * item.quantity,
          };
        });

        await db.insert(proformaItems).values(proformaItemsData);

        return newProforma;
      }, 'Create proforma');
    } catch (error) {
      logger.error('Failed to create proforma', { error, userId });
      throw new DatabaseError(`Failed to create proforma: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateProforma(id: number, proforma: Partial<InsertProforma>): Promise<Proforma> {
    try {
      return await executeWithRetry(async () => {
        const updateData: any = { ...proforma, updatedAt: new Date() };

        // If profit percentage is being updated, recalculate prices
        if (proforma.profitPercentage !== undefined) {
          const existingProforma = await this.getProforma(id);
          if (!existingProforma) {
            throw new Error('Proforma not found');
          }

          // Recalculate total price
          const totalPrice = Math.round(existingProforma.totalCost * (1 + proforma.profitPercentage / 100));
          updateData.totalPrice = totalPrice;

          // Update proforma items prices
          for (const item of existingProforma.items) {
            const unitPrice = Math.round(item.unitCost * (1 + proforma.profitPercentage / 100));
            await db
              .update(proformaItems)
              .set({
                unitPrice,
                totalPrice: unitPrice * item.quantity,
              })
              .where(eq(proformaItems.id, item.id));
          }
        }

        const [updatedProforma] = await db
          .update(proformas)
          .set(updateData)
          .where(eq(proformas.id, id))
          .returning();

        if (!updatedProforma) {
          throw new Error('Proforma not found');
        }

        return updatedProforma;
      }, 'Update proforma');
    } catch (error) {
      logger.error(`Failed to update proforma ${id}`, { error });
      throw new DatabaseError(`Failed to update proforma: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteProforma(id: number): Promise<void> {
    try {
      await executeWithRetry(async () => {
        // Delete proforma items first
        await db.delete(proformaItems).where(eq(proformaItems.proformaId, id));

        // Delete the proforma
        await db.delete(proformas).where(eq(proformas.id, id));
      }, 'Delete proforma');
    } catch (error) {
      logger.error(`Failed to delete proforma ${id}`, { error });
      throw new DatabaseError(`Failed to delete proforma: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateProformaNumber(): Promise<string> {
    try {
      return await executeWithRetry(async () => {
        const year = new Date().getFullYear();

        // Get the highest number for this year
        const result = await db
          .select({
            maxNumber: sql<number>`MAX(CAST(SUBSTRING(${proformas.proformaNumber} FROM '[0-9]+$') AS INTEGER))`,
          })
          .from(proformas)
          .where(sql`${proformas.proformaNumber} LIKE ${`PRF-${year}-%`}`);

        const nextNumber = (result[0]?.maxNumber || 0) + 1;
        return `PRF-${year}-${nextNumber.toString().padStart(3, '0')}`;
      }, 'Generate proforma number');
    } catch (error) {
      logger.error('Failed to generate proforma number', { error });
      throw new DatabaseError(`Failed to generate proforma number: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Company methods
  async getCompanies(): Promise<Company[]> {
    try {
      return await executeWithRetry(async () => {
        return await db.select().from(companies).orderBy(companies.name);
      }, 'Get companies');
    } catch (error) {
      logger.error('Failed to get companies', { error });
      throw new DatabaseError(`Failed to get companies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCompany(id: number): Promise<Company | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [company] = await db.select().from(companies).where(eq(companies.id, id));
        return company || undefined;
      }, 'Get company');
    } catch (error) {
      logger.error('Failed to get company', { error, companyId: id });
      throw new DatabaseError(`Failed to get company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    try {
      return await executeWithRetry(async () => {
        const [created] = await db
          .insert(companies)
          .values(company)
          .returning();
        return created;
      }, 'Create company');
    } catch (error) {
      logger.error('Failed to create company', { error, company });
      throw new DatabaseError(`Failed to create company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [updated] = await db
          .update(companies)
          .set({ ...companyData, updatedAt: new Date() })
          .where(eq(companies.id, id))
          .returning();
        return updated || undefined;
      }, 'Update company');
    } catch (error) {
      logger.error('Failed to update company', { error, companyId: id, companyData });
      throw new DatabaseError(`Failed to update company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteCompany(id: number): Promise<boolean> {
    try {
      return await executeWithRetry(async () => {
        const result = await db.delete(companies).where(eq(companies.id, id));
        return result.rowCount > 0;
      }, 'Delete company');
    } catch (error) {
      logger.error('Failed to delete company', { error, companyId: id });
      throw new DatabaseError(`Failed to delete company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDefaultCompany(): Promise<Company | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [company] = await db.select().from(companies).where(eq(companies.isDefault, true));
        return company || undefined;
      }, 'Get default company');
    } catch (error) {
      logger.error('Failed to get default company', { error });
      throw new DatabaseError(`Failed to get default company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async clearDefaultCompany(): Promise<void> {
    try {
      await executeWithRetry(async () => {
        await db
          .update(companies)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(companies.isDefault, true));
      }, 'Clear default company');
    } catch (error) {
      logger.error('Failed to clear default company', { error });
      throw new DatabaseError(`Failed to clear default company: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Proforma permissions methods implementation
  async getUserProformaPermissions(userId: number): Promise<UserProformaPermission | undefined> {
    try {
      const [permission] = await db
        .select()
        .from(userProformaPermissions)
        .where(eq(userProformaPermissions.userId, userId));
      return permission;
    } catch (error) {
      logger.error('Error getting user proforma permissions', error);
      throw new DatabaseError(`Failed to get user proforma permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUsersWithProformaAccess(): Promise<Array<{ id: number; username: string; proformaPermissions?: UserProformaPermission; }>> {
    try {
      const usersWithPermissions = await db
        .select({
          id: users.id,
          username: users.username,
          proformaPermissions: userProformaPermissions
        })
        .from(users)
        .leftJoin(userProformaPermissions, eq(users.id, userProformaPermissions.userId));

      return usersWithPermissions.map(user => ({
        id: user.id,
        username: user.username,
        proformaPermissions: user.proformaPermissions || undefined
      }));
    } catch (error) {
      logger.error('Error getting users with proforma access', error);
      throw new DatabaseError(`Failed to get users with proforma access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setUserProformaPermissions(userId: number, permissions: InsertUserProformaPermission, grantedById: number): Promise<UserProformaPermission> {
    try {
      const [existingPermission] = await db
        .select()
        .from(userProformaPermissions)
        .where(eq(userProformaPermissions.userId, userId));

      if (existingPermission) {
        // Update existing permissions
        const [updatedPermission] = await db
          .update(userProformaPermissions)
          .set(permissions)
          .where(eq(userProformaPermissions.userId, userId))
          .returning();
        return updatedPermission;
      } else {
        // Create new permissions
        const [newPermission] = await db
          .insert(userProformaPermissions)
          .values({
            userId,
            grantedById,
            ...permissions
          })
          .returning();
        return newPermission;
      }
    } catch (error) {
      logger.error('Error setting user proforma permissions', error);
      throw new DatabaseError(`Failed to set user proforma permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Expense methods implementation
  async getExpenses(): Promise<(Expense & { createdBy: Pick<User, 'id' | 'username'>; receipts: (ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[] })[]> {
    try {
      return await executeWithRetry(async () => {
        const expensesWithCreator = await db
          .select({
            id: expenses.id,
            serviceName: expenses.serviceName,
            beneficiary: expenses.beneficiary,
            amount: expenses.amount,
            frequency: expenses.frequency,
            lastPaidDate: expenses.lastPaidDate,
            nextPaymentDate: expenses.nextPaymentDate,
            status: expenses.status,
            description: expenses.description,
            createdById: expenses.createdById,
            createdAt: expenses.createdAt,
            updatedAt: expenses.updatedAt,
            createdBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(expenses)
          .leftJoin(users, eq(expenses.createdById, users.id))
          .orderBy(desc(expenses.createdAt));

        // Get receipts for each expense
        const expensesWithReceipts = await Promise.all(
          expensesWithCreator.map(async (expense) => {
            const receipts = await this.getExpenseReceipts(expense.id);
            return {
              ...expense,
              receipts,
            };
          })
        );

        return expensesWithReceipts;
      }, 'Get all expenses');
    } catch (error) {
      logger.error('Error getting expenses', error);
      throw new DatabaseError(`Failed to get expenses: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getExpense(id: number): Promise<(Expense & { createdBy: Pick<User, 'id' | 'username'>; receipts: (ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[] }) | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [expense] = await db
          .select({
            id: expenses.id,
            serviceName: expenses.serviceName,
            beneficiary: expenses.beneficiary,
            amount: expenses.amount,
            frequency: expenses.frequency,
            lastPaidDate: expenses.lastPaidDate,
            nextPaymentDate: expenses.nextPaymentDate,
            status: expenses.status,
            description: expenses.description,
            createdById: expenses.createdById,
            createdAt: expenses.createdAt,
            updatedAt: expenses.updatedAt,
            createdBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(expenses)
          .leftJoin(users, eq(expenses.createdById, users.id))
          .where(eq(expenses.id, id));

        if (!expense) return undefined;

        const receipts = await this.getExpenseReceipts(expense.id);
        return {
          ...expense,
          receipts,
        };
      }, 'Get expense by ID');
    } catch (error) {
      logger.error(`Error getting expense with ID ${id}`, error);
      throw new DatabaseError(`Failed to get expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createExpense(expense: InsertExpense, userId: number): Promise<Expense> {
    try {
      return await executeWithRetry(async () => {
        const [newExpense] = await db
          .insert(expenses)
          .values({
            ...expense,
            createdById: userId,
          })
          .returning();
        return newExpense;
      }, 'Create expense');
    } catch (error) {
      logger.error('Error creating expense', error);
      throw new DatabaseError(`Failed to create expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense> {
    try {
      return await executeWithRetry(async () => {
        const [updatedExpense] = await db
          .update(expenses)
          .set({
            ...expense,
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, id))
          .returning();
        return updatedExpense;
      }, 'Update expense');
    } catch (error) {
      logger.error(`Error updating expense with ID ${id}`, error);
      throw new DatabaseError(`Failed to update expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteExpense(id: number): Promise<void> {
    try {
      return await executeWithRetry(async () => {
        // First delete all receipts
        await db.delete(expenseReceipts).where(eq(expenseReceipts.expenseId, id));
        // Then delete the expense
        await db.delete(expenses).where(eq(expenses.id, id));
      }, 'Delete expense');
    } catch (error) {
      logger.error(`Error deleting expense with ID ${id}`, error);
      throw new DatabaseError(`Failed to delete expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async markExpenseAsPaid(id: number): Promise<Expense> {
    try {
      return await executeWithRetry(async () => {
        // Get current expense to calculate next payment date
        const currentExpense = await db
          .select()
          .from(expenses)
          .where(eq(expenses.id, id))
          .limit(1);

        if (currentExpense.length === 0) {
          throw new Error('Expense not found');
        }

        const expense = currentExpense[0];
        const today = new Date();
        let nextPaymentDate = new Date(expense.nextPaymentDate);

        // Calculate next payment date based on frequency
        switch (expense.frequency) {
          case 'monthly':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
            break;
          case 'yearly':
            nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
            break;
        }

        // Update the expense with new dates
        const [updatedExpense] = await db
          .update(expenses)
          .set({
            lastPaidDate: today,
            nextPaymentDate: nextPaymentDate,
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, id))
          .returning();

        return updatedExpense;
      }, 'Mark expense as paid');
    } catch (error) {
      logger.error(`Error marking expense as paid with ID ${id}`, error);
      throw new DatabaseError(`Failed to mark expense as paid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getExpenseReceipts(expenseId: number): Promise<(ExpenseReceipt & { uploadedBy: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        const receipts = await db
          .select({
            id: expenseReceipts.id,
            expenseId: expenseReceipts.expenseId,
            fileName: expenseReceipts.fileName,
            filePath: expenseReceipts.filePath,
            fileSize: expenseReceipts.fileSize,
            mimeType: expenseReceipts.mimeType,
            paymentDate: expenseReceipts.paymentDate,
            amount: expenseReceipts.amount,
            notes: expenseReceipts.notes,
            uploadedById: expenseReceipts.uploadedById,
            createdAt: expenseReceipts.createdAt,
            uploadedBy: {
              id: users.id,
              username: users.username,
            },
          })
          .from(expenseReceipts)
          .leftJoin(users, eq(expenseReceipts.uploadedById, users.id))
          .where(eq(expenseReceipts.expenseId, expenseId))
          .orderBy(desc(expenseReceipts.createdAt));

        return receipts;
      }, 'Get expense receipts');
    } catch (error) {
      logger.error(`Error getting receipts for expense ${expenseId}`, error);
      throw new DatabaseError(`Failed to get expense receipts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async uploadExpenseReceipt(receipt: InsertExpenseReceipt, userId: number): Promise<ExpenseReceipt> {
    try {
      return await executeWithRetry(async () => {
        const [newReceipt] = await db
          .insert(expenseReceipts)
          .values({
            ...receipt,
            uploadedById: userId,
          })
          .returning();
        return newReceipt;
      }, 'Upload expense receipt');
    } catch (error) {
      logger.error('Error uploading expense receipt', error);
      throw new DatabaseError(`Failed to upload expense receipt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteExpenseReceipt(id: number): Promise<void> {
    try {
      return await executeWithRetry(async () => {
        await db.delete(expenseReceipts).where(eq(expenseReceipts.id, id));
      }, 'Delete expense receipt');
    } catch (error) {
      logger.error(`Error deleting expense receipt with ID ${id}`, error);
      throw new DatabaseError(`Failed to delete expense receipt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Expense permissions methods
  async getUserExpensePermissions(userId: number): Promise<UserExpensePermissions | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [permissions] = await db
          .select()
          .from(userExpensePermissions)
          .where(eq(userExpensePermissions.userId, userId));
        return permissions;
      }, 'Get user expense permissions');
    } catch (error) {
      logger.error(`Failed to get expense permissions for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get expense permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUsersWithExpenseAccess(): Promise<Array<{ id: number; username: string; expensePermissions?: UserExpensePermissions; }>> {
    try {
      return await executeWithRetry(async () => {
        // Get ALL users and their expense permissions (if any)
        const usersWithPermissions = await db
          .select({
            id: users.id,
            username: users.username,
            expensePermissions: userExpensePermissions,
          })
          .from(users)
          .leftJoin(userExpensePermissions, eq(users.id, userExpensePermissions.userId))
          .orderBy(users.username);

        return usersWithPermissions.map(row => ({
          id: row.id,
          username: row.username,
          expensePermissions: row.expensePermissions || undefined,
        }));
      }, 'Get users with expense access');
    } catch (error) {
      logger.error('Failed to get users with expense access', { error });
      throw new DatabaseError(`Failed to get users with expense access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setUserExpensePermissions(userId: number, permissions: InsertUserExpensePermissions, grantedById: number): Promise<UserExpensePermissions> {
    try {
      return await executeWithRetry(async () => {
        const [newPermissions] = await db
          .insert(userExpensePermissions)
          .values({
            userId,
            ...permissions,
            grantedById,
          })
          .onConflictDoUpdate({
            target: userExpensePermissions.userId,
            set: {
              ...permissions,
              grantedById,
            },
          })
          .returning();

        return newPermissions;
      }, 'Set user expense permissions');
    } catch (error) {
      logger.error(`Failed to set expense permissions for user ${userId}`, { error, permissions });
      throw new DatabaseError(`Failed to set expense permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Client permissions methods
  async getUserClientPermissions(userId: number): Promise<UserClientPermissions | undefined> {
    try {
      return await executeWithRetry(async () => {
        const [permissions] = await db
          .select()
          .from(userClientPermissions)
          .where(eq(userClientPermissions.userId, userId));
        return permissions;
      }, 'Get user client permissions');
    } catch (error) {
      logger.error(`Failed to get client permissions for user ${userId}`, { error });
      throw new DatabaseError(`Failed to get client permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getUsersWithClientAccess(): Promise<Array<{ id: number; username: string; clientPermissions?: UserClientPermissions; }>> {
    try {
      return await executeWithRetry(async () => {
        // Get ALL users and their client permissions (if any)
        const usersWithPermissions = await db
          .select({
            id: users.id,
            username: users.username,
            clientPermissions: userClientPermissions,
          })
          .from(users)
          .leftJoin(userClientPermissions, eq(users.id, userClientPermissions.userId))
          .orderBy(users.username);

        return usersWithPermissions.map(row => ({
          id: row.id,
          username: row.username,
          clientPermissions: row.clientPermissions || undefined,
        }));
      }, 'Get users with client access');
    } catch (error) {
      logger.error('Failed to get users with client access', { error });
      throw new DatabaseError(`Failed to get users with client access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setUserClientPermissions(userId: number, permissions: InsertUserClientPermissions, grantedById: number): Promise<UserClientPermissions> {
    try {
      return await executeWithRetry(async () => {
        const [newPermissions] = await db
          .insert(userClientPermissions)
          .values({
            userId,
            ...permissions,
            grantedById,
          })
          .onConflictDoUpdate({
            target: userClientPermissions.userId,
            set: {
              ...permissions,
              grantedById,
            },
          })
          .returning();

        return newPermissions;
      }, 'Set user client permissions');
    } catch (error) {
      logger.error(`Failed to set client permissions for user ${userId}`, { error, permissions });
      throw new DatabaseError(`Failed to set client permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const storage = new DatabaseStorage();