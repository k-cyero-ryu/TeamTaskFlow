import { Task, InsertTask, User, InsertUser, Subtask, TaskStep, Comment, InsertComment } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { tasks, users, taskParticipants, subtasks, taskSteps, comments } from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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

  sessionStore: session.Store;

  // Comments
  getTaskComments(taskId: number): Promise<(Comment & { user: User })[]>;
  createComment(comment: InsertComment & { userId: number }): Promise<Comment>;
  updateComment(id: number, content: string): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
}

export const storage = new DatabaseStorage();