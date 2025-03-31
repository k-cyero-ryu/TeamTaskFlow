import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExtendedTask } from "@/lib/types";
import { Subtask, TaskStep } from "@shared/schema";

/**
 * Hook for managing task subtasks with optimized query caching
 */
export function useSubtasks(taskId: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query key for task-specific subtasks
  const taskSubtasksQueryKey = [`/api/tasks/${taskId}/subtasks`];
  
  // Query for subtasks with proper error handling
  const { 
    data: subtasks = [], 
    isLoading,
    error,
    refetch 
  } = useQuery<Subtask[]>({
    queryKey: taskSubtasksQueryKey,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduce network requests
    gcTime: 10 * 60 * 1000,   // 10 minutes - keep in cache longer
  });
  
  // Improved mutation with optimistic updates and more granular cache invalidation
  const updateSubtaskStatus = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/subtasks/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return { id, completed, data };
    },
    onMutate: async ({ id, completed }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: taskSubtasksQueryKey });
      
      // Also cancel queries for the specific task since it will need updating
      await queryClient.cancelQueries({ queryKey: [`/api/tasks/${taskId}`] });
      
      // Start with the global task list (if available)
      const previousTasks = queryClient.getQueryData<ExtendedTask[]>(["/api/tasks"]);
      const previousTask = queryClient.getQueryData<ExtendedTask>([`/api/tasks/${taskId}`]);
      const previousSubtasks = queryClient.getQueryData<Subtask[]>(taskSubtasksQueryKey);
      
      // Create a snapshot of the previous state for potential rollback
      const snapshot = {
        previousTasks,
        previousTask,
        previousSubtasks
      };
      
      // Update the global task list (if available)
      if (previousTasks) {
        const updatedTasks = previousTasks.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              subtasks: t.subtasks?.map((s) =>
                s.id === id ? { ...s, completed } : s
              ),
            };
          }
          return t;
        });
        
        queryClient.setQueryData<ExtendedTask[]>(["/api/tasks"], updatedTasks);
      }
      
      // Update the specific task detail cache (if available)
      if (previousTask) {
        const updatedTask = {
          ...previousTask,
          subtasks: previousTask.subtasks?.map((s) =>
            s.id === id ? { ...s, completed } : s
          ),
        };
        
        queryClient.setQueryData<ExtendedTask>([`/api/tasks/${taskId}`], updatedTask);
      }
      
      // Update the subtasks cache (if available)
      if (previousSubtasks) {
        const updatedSubtasks = previousSubtasks.map((s) =>
          s.id === id ? { ...s, completed } : s
        );
        
        queryClient.setQueryData<Subtask[]>(taskSubtasksQueryKey, updatedSubtasks);
      }
      
      return snapshot;
    },
    onError: (err, variables, context) => {
      // Rollback to previous state if there's an error
      if (context) {
        if (context.previousTasks) {
          queryClient.setQueryData(["/api/tasks"], context.previousTasks);
        }
        if (context.previousTask) {
          queryClient.setQueryData([`/api/tasks/${taskId}`], context.previousTask);
        }
        if (context.previousSubtasks) {
          queryClient.setQueryData(taskSubtasksQueryKey, context.previousSubtasks);
        }
      }
      
      toast({
        title: "Error updating subtask",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
    onSuccess: (_, { completed }) => {
      toast({
        title: "Subtask updated",
        description: `Subtask marked as ${completed ? "completed" : "incomplete"}`,
      });
    },
    onSettled: () => {
      // Invalidate only the specific caches that were affected
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
      queryClient.invalidateQueries({ queryKey: taskSubtasksQueryKey });
      
      // Use a more selective approach to invalidate the task list
      // This is more efficient than invalidating all tasks
      queryClient.invalidateQueries({ 
        queryKey: ["/api/tasks"],
        // Only refetch if the data is older than 10 seconds
        refetchType: "inactive", 
      });
    },
  });

  return {
    subtasks,
    isLoading,
    error,
    refetch,
    updateSubtaskStatus
  };
}

/**
 * Hook for managing task steps with optimized query caching
 */
export function useTaskSteps(taskId: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Query key for task-specific steps
  const taskStepsQueryKey = [`/api/tasks/${taskId}/steps`];
  
  // Query for steps with proper error handling and optimization
  const { 
    data: steps = [], 
    isLoading,
    error,
    refetch 
  } = useQuery<TaskStep[]>({
    queryKey: taskStepsQueryKey,
    staleTime: 5 * 60 * 1000, // 5 minutes - reduce network requests
    gcTime: 10 * 60 * 1000,   // 10 minutes - keep in cache longer
  });
  
  // Improved mutation with optimistic updates and more granular cache invalidation
  const updateStepStatus = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/steps/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return { id, completed, data };
    },
    onMutate: async ({ id, completed }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: taskStepsQueryKey });
      
      // Also cancel queries for the specific task since it will need updating
      await queryClient.cancelQueries({ queryKey: [`/api/tasks/${taskId}`] });
      
      // Start with various caches (if available)
      const previousTasks = queryClient.getQueryData<ExtendedTask[]>(["/api/tasks"]);
      const previousTask = queryClient.getQueryData<ExtendedTask>([`/api/tasks/${taskId}`]);
      const previousSteps = queryClient.getQueryData<TaskStep[]>(taskStepsQueryKey);
      
      // Create a snapshot of the previous state for potential rollback
      const snapshot = {
        previousTasks,
        previousTask,
        previousSteps
      };
      
      // Update the global task list (if available)
      if (previousTasks) {
        const updatedTasks = previousTasks.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              steps: t.steps?.map((s) =>
                s.id === id ? { ...s, completed } : s
              ),
            };
          }
          return t;
        });
        
        queryClient.setQueryData<ExtendedTask[]>(["/api/tasks"], updatedTasks);
      }
      
      // Update the specific task detail cache (if available)
      if (previousTask) {
        const updatedTask = {
          ...previousTask,
          steps: previousTask.steps?.map((s) =>
            s.id === id ? { ...s, completed } : s
          ),
        };
        
        queryClient.setQueryData<ExtendedTask>([`/api/tasks/${taskId}`], updatedTask);
      }
      
      // Update the steps cache (if available)
      if (previousSteps) {
        const updatedSteps = previousSteps.map((s) =>
          s.id === id ? { ...s, completed } : s
        );
        
        queryClient.setQueryData<TaskStep[]>(taskStepsQueryKey, updatedSteps);
      }
      
      return snapshot;
    },
    onError: (err, variables, context) => {
      // Rollback to previous state if there's an error
      if (context) {
        if (context.previousTasks) {
          queryClient.setQueryData(["/api/tasks"], context.previousTasks);
        }
        if (context.previousTask) {
          queryClient.setQueryData([`/api/tasks/${taskId}`], context.previousTask);
        }
        if (context.previousSteps) {
          queryClient.setQueryData(taskStepsQueryKey, context.previousSteps);
        }
      }
      
      toast({
        title: "Error updating step",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
    onSuccess: (_, { completed }) => {
      toast({
        title: "Step updated",
        description: `Step marked as ${completed ? "completed" : "incomplete"}`,
      });
    },
    onSettled: () => {
      // Invalidate only the specific caches that were affected
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
      queryClient.invalidateQueries({ queryKey: taskStepsQueryKey });
      
      // Use a more selective approach to invalidate the task list
      queryClient.invalidateQueries({ 
        queryKey: ["/api/tasks"],
        // Only refetch if the data is older than 10 seconds
        refetchType: "inactive", 
      });
    },
  });

  return {
    steps,
    isLoading,
    error,
    refetch,
    updateStepStatus
  };
}