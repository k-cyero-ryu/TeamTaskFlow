import { Task, InsertTask, User, InsertUser, Subtask, TaskStep, Comment, InsertComment, PrivateMessage, InsertPrivateMessage } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc } from "drizzle-orm";
import { tasks, users, taskParticipants, subtasks, taskSteps, comments, privateMessages } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

// Add error handling wrapper
async function withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Database operation failed:', error);
    // If it's a connection error, wait and retry once
    if (error.message.includes('connection')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        return await operation();
      } catch (retryError) {
        console.error('Retry failed:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Wrap the first few critical methods with error handling
  async getUser(id: number): Promise<User | undefined> {
    return await withErrorHandling(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await withErrorHandling(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await withErrorHandling(async () => {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    });
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask & { creatorId: number; participantIds?: number[] }): Promise<Task> {
    const { subtasks: subtaskList, steps, participantIds, ...taskData } = task;

    // Create the task
    const [newTask] = await db
      .insert(tasks)
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
  }

  async updateTaskStatus(id: number, status: string): Promise<Task> {
    const [updatedTask] = await db
      .update(tasks)
      .set({ status })
      .where(eq(tasks.id, id))
      .returning();

    if (!updatedTask) {
      throw new Error("Task not found");
    }

    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(taskParticipants).where(eq(taskParticipants.taskId, id));
    await db.delete(subtasks).where(eq(subtasks.taskId, id));
    await db.delete(taskSteps).where(eq(taskSteps.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getSubtasks(taskId: number): Promise<Subtask[]> {
    return await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
  }

  async getTaskSteps(taskId: number): Promise<TaskStep[]> {
    return await db.select().from(taskSteps).where(eq(taskSteps.taskId, taskId));
  }

  async getTaskParticipants(taskId: number): Promise<{ username: string; id: number }[]> {
    const participants = await db
      .select({
        username: users.username,
        id: users.id,
      })
      .from(taskParticipants)
      .innerJoin(users, eq(taskParticipants.userId, users.id))
      .where(eq(taskParticipants.taskId, taskId));

    return participants;
  }

  async updateSubtaskStatus(id: number, completed: boolean): Promise<void> {
    await db.update(subtasks).set({ completed }).where(eq(subtasks.id, id));
  }

  async updateTaskStepStatus(id: number, completed: boolean): Promise<void> {
    await db.update(taskSteps).set({ completed }).where(eq(taskSteps.id, id));
  }

  async getTaskComments(taskId: number): Promise<(Comment & { user: User })[]> {
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
  }

  async createComment(comment: InsertComment & { userId: number }): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values({
        content: comment.content,
        taskId: comment.taskId,
        userId: comment.userId,
      })
      .returning();
    return newComment;
  }

  async updateComment(id: number, content: string): Promise<Comment> {
    const [updatedComment] = await db
      .update(comments)
      .set({
        content,
        updatedAt: new Date()
      })
      .where(eq(comments.id, id))
      .returning();
    return updatedComment;
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  async getPrivateMessages(userId1: number, userId2: number): Promise<(PrivateMessage & { sender: User })[]> {
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
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
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
  }

  async getUserConversations(userId: number): Promise<{ user: User; lastMessage: PrivateMessage & { sender: User } }[]> {
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
  }

  async createPrivateMessage(message: InsertPrivateMessage & { senderId: number }): Promise<PrivateMessage> {
    const [newMessage] = await db
      .insert(privateMessages)
      .values({
        content: message.content,
        senderId: message.senderId,
        recipientId: message.recipientId,
      })
      .returning();
    return newMessage;
  }

  async markMessagesAsRead(userId: number, otherUserId: number): Promise<void> {
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
  }
}

export const storage = new DatabaseStorage();