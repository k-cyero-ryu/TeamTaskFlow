import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Task, Subtask, TaskStep, Workflow, WorkflowStage } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, ChevronRight, CheckCircle, Clock, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TaskDetailDialog from "./task-detail-dialog";
import { cn } from "@/lib/utils";

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  steps?: TaskStep[];
  participants?: { username: string; id: number }[];
  responsible?: { username: string; id: number };
  workflow?: Workflow;
  stage?: WorkflowStage;
}

export default function TaskCard({ task }: { task: ExtendedTask }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch workflow and stage information if they exist
  const { data: workflow } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${task.workflowId}`],
    enabled: !!task.workflowId,
  });

  const { data: stage } = useQuery<WorkflowStage>({
    queryKey: [`/api/workflows/${task.workflowId}/stages/${task.stageId}`],
    enabled: !!task.workflowId && !!task.stageId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      setIsTransitioning(true);
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}/status`, {
        status,
      });
      return res.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task updated",
        description: `Task status changed to ${status}`,
      });
    },
    onSettled: () => {
      setIsTransitioning(false);
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

  const statusConfig = {
    todo: {
      color: "bg-slate-500",
      icon: Circle,
    },
    "in-progress": {
      color: "bg-blue-500",
      icon: Clock,
    },
    done: {
      color: "bg-green-500",
      icon: CheckCircle,
    },
  };

  const StatusIcon = statusConfig[task.status as keyof typeof statusConfig].icon;

  // Calculate completion metrics
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSteps = task.steps?.length || 0;
  const completedSteps = task.steps?.filter((s) => s.completed).length || 0;

  return (
    <>
      <Card 
        className={cn(
          "hover:bg-secondary/50 cursor-pointer transition-all duration-300",
          isTransitioning && "scale-[0.98] opacity-80"
        )}
        onClick={() => setDetailOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "transition-colors duration-300 flex items-center gap-1",
                statusConfig[task.status as keyof typeof statusConfig].color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {task.status}
            </Badge>
            {workflow && stage && (
              <Badge
                variant="outline"
                className="flex items-center gap-1"
                style={{
                  borderColor: stage.color || '#4444FF',
                  color: stage.color || '#4444FF'
                }}
              >
                {workflow.name} - {stage.name}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate("todo");
                }}
                disabled={task.status === "todo" || isTransitioning}
                className="gap-2"
              >
                <Circle className="h-4 w-4" /> Mark as Todo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate("in-progress");
                }}
                disabled={task.status === "in-progress" || isTransitioning}
                className="gap-2"
              >
                <Clock className="h-4 w-4" /> Mark as In Progress
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  updateStatusMutation.mutate("done");
                }}
                disabled={task.status === "done" || isTransitioning}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" /> Mark as Done
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTaskMutation.mutate();
                }}
                disabled={isTransitioning}
              >
                <Trash2 className="h-4 w-4" /> Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-semibold">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="mt-4 space-y-2">
            {totalSubtasks > 0 && (
              <p className="text-sm text-muted-foreground">
                Subtasks: {completedSubtasks}/{totalSubtasks} completed
              </p>
            )}
            {totalSteps > 0 && (
              <p className="text-sm text-muted-foreground">
                Steps: {completedSteps}/{totalSteps} completed
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {task.responsible?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm">
                Due {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No date"}
              </p>
            </div>
          </div>
          {task.participants && task.participants.length > 0 && (
            <div className="flex -space-x-2">
              {task.participants.slice(0, 3).map((participant) => (
                <Avatar key={participant.id} className="h-8 w-8 border-2 border-background">
                  <AvatarFallback>
                    {participant.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.participants.length > 3 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs">
                  +{task.participants.length - 3}
                </div>
              )}
            </div>
          )}
        </CardFooter>
      </Card>

      <TaskDetailDialog
        task={{
          ...task,
          workflow,
          stage,
        }}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}