import { useQuery, useMutation } from "@tanstack/react-query";
import { ExtendedTask, TaskStatus } from "@/lib/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@shared/schema";

/**
 * A hook that provides all task-related data fetching and mutations
 */
export function useTasks(options?: { workflowId?: number; stageId?: number }) {
  const { toast } = useToast();
  const { workflowId, stageId } = options || {};

  // Fetch all tasks
  const { 
    data: tasks = [], 
    isLoading,
    isError,
    error
  } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    select: (data) => {
      if (workflowId !== undefined) {
        return data.filter(task => task.workflowId === workflowId);
      }
      if (stageId !== undefined && workflowId !== undefined) {
        return data.filter(task => 
          task.workflowId === workflowId && task.stageId === stageId
        );
      }
      return data;
    }
  });

  // Get task by id
  const getTaskById = (id: number) => {
    return tasks.find(task => task.id === id);
  };

  // Calculate task statistics
  const getTaskStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.status === "done").length;
    const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length;
    const todoTasks = tasks.filter((task) => task.status === "todo").length;
    const progressPercentage = totalTasks ? (completedTasks / totalTasks) * 100 : 0;
    
    return {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
      progressPercentage
    };
  };

  // Update task status mutation
  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: TaskStatus }) => {
      const res = await apiRequest(`/api/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task updated",
        description: `Task status changed to ${status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update task: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/tasks/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete task: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update task stage mutation
  const updateTaskStage = useMutation({
    mutationFn: async ({ taskId, stageId }: { taskId: number; stageId: number }) => {
      const res = await apiRequest(`/api/tasks/${taskId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId }),
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Success",
        description: "Task moved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to move task: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  return {
    tasks,
    isLoading,
    isError,
    error,
    getTaskById,
    getTaskStats,
    updateTaskStatus,
    deleteTask,
    updateTaskStage
  };
}