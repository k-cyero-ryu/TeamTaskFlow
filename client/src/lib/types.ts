import { Task, Subtask, TaskStep, Workflow, WorkflowStage, User, Comment } from "@shared/schema";

/**
 * Extended Task type with related entities
 * Used throughout the application for consistent typing
 */
export interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  steps?: TaskStep[];
  participants?: { username: string; id: number }[];
  responsible?: { username: string; id: number };
  workflow?: Workflow;
  stage?: WorkflowStage;
}

/**
 * Task status configuration with styled display attributes
 */
export const taskStatusConfig = {
  todo: {
    color: "bg-slate-500",
    textColor: "text-white",
    icon: "Circle",
    label: "To Do"
  },
  "in-progress": {
    color: "bg-blue-500",
    textColor: "text-white", 
    icon: "Clock",
    label: "In Progress"
  },
  done: {
    color: "bg-green-500",
    textColor: "text-white",
    icon: "CheckCircle",
    label: "Done"
  },
};

export type TaskStatus = keyof typeof taskStatusConfig;

/**
 * Comment with full user information
 */
export interface CommentWithUser extends Comment {
  user: Pick<User, 'id' | 'username'>;
}

/**
 * Task with counts for subtasks and steps
 */
export interface TaskWithCounts extends ExtendedTask {
  totalSubtasks: number;
  completedSubtasks: number;
  totalSteps: number;
  completedSteps: number;
}