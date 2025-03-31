import { Task, InsertTask, User, InsertUser, Subtask, TaskStep, Comment, InsertComment, PrivateMessage, InsertPrivateMessage, Workflow, WorkflowStage, WorkflowTransition, InsertWorkflow, InsertWorkflowStage, InsertWorkflowTransition } from "@shared/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { tasks, users, taskParticipants, subtasks, taskSteps, comments, privateMessages, workflows, workflowStages, workflowTransitions } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool, db, executeWithRetry } from "./database/connection";
import { Logger } from "./utils/logger";
import { DatabaseError } from "./utils/errors";

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

  async getPrivateMessages(userId1: number, userId2: number): Promise<(PrivateMessage & { sender: Pick<User, 'id' | 'username'> })[]> {
    try {
      return await executeWithRetry(async () => {
        return await db
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
}

export const storage = new DatabaseStorage();