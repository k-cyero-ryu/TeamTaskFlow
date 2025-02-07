import { useAuth } from "@/hooks/use-auth";
import { Task, Subtask, TaskStep } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  steps?: TaskStep[];
  participants?: { username: string; id: number }[];
}

export default function TaskCard({ task }: { task: ExtendedTask }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task updated",
        description: "The task status has been updated successfully.",
      });
    },
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/subtasks/${id}/status`, {
        completed,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/steps/${id}/status`, {
        completed,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tasks/${task.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    },
  });

  const statusColors = {
    todo: "bg-slate-500",
    "in-progress": "bg-blue-500",
    done: "bg-green-500",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Badge
          variant="secondary"
          className={`${statusColors[task.status as keyof typeof statusColors]}`}
        >
          {task.status}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("todo")}
              disabled={task.status === "todo"}
            >
              Mark as Todo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("in-progress")}
              disabled={task.status === "in-progress"}
            >
              Mark as In Progress
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateStatusMutation.mutate("done")}
              disabled={task.status === "done"}
            >
              Mark as Done
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => deleteTaskMutation.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold">{task.title}</h3>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
        )}

        {/* Participants */}
        {task.participants && task.participants.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Participants</h4>
            <div className="flex flex-wrap gap-2">
              {task.participants.map((participant) => (
                <Badge key={participant.id} variant="outline">
                  {participant.username}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Subtasks</h4>
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={subtask.completed}
                    onCheckedChange={(checked) =>
                      updateSubtaskMutation.mutate({
                        id: subtask.id,
                        completed: checked as boolean,
                      })
                    }
                  />
                  <span className={subtask.completed ? "line-through" : ""}>
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {task.steps && task.steps.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Steps</h4>
            <div className="space-y-2">
              {task.steps
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <div key={step.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={step.completed}
                        onCheckedChange={(checked) =>
                          updateStepMutation.mutate({
                            id: step.id,
                            completed: checked as boolean,
                          })
                        }
                      />
                      <span className={step.completed ? "line-through" : ""}>
                        {step.title}
                      </span>
                    </div>
                    {step.description && (
                      <p className="text-sm text-muted-foreground ml-6">
                        {step.description}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {task.responsibleId ? "R" : "C"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm">
              Created {format(new Date(task.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}