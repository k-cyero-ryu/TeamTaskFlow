import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExtendedTask } from "@/lib/types";

/**
 * Hook for managing task subtasks
 */
export function useSubtasks(taskId: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateSubtaskStatus = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/subtasks/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return { id, completed, data };
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });

      const previousTasks = queryClient.getQueryData<ExtendedTask[]>(["/api/tasks"]);

      const updatedTasks = previousTasks?.map((t) => {
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

      if (updatedTasks) {
        queryClient.setQueryData<ExtendedTask[]>(["/api/tasks"], updatedTasks);
      }

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      toast({
        title: "Error updating subtask",
        description: err.message,
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  return {
    updateSubtaskStatus
  };
}

/**
 * Hook for managing task steps
 */
export function useTaskSteps(taskId: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const updateStepStatus = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/steps/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return { id, completed, data };
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });

      const previousTasks = queryClient.getQueryData<ExtendedTask[]>(["/api/tasks"]);

      const updatedTasks = previousTasks?.map((t) => {
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

      if (updatedTasks) {
        queryClient.setQueryData<ExtendedTask[]>(["/api/tasks"], updatedTasks);
      }

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/tasks"], context.previousTasks);
      }
      toast({
        title: "Error updating step",
        description: err.message,
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
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  return {
    updateStepStatus
  };
}