import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Task, Workflow, WorkflowStage } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import TaskDetailDialog from "./task-detail-dialog";
import { cn } from "@/lib/utils";
import { ExtendedTask, TaskStatus } from "@/lib/types";
import { TaskStatusBadge } from "./task/task-status-badge";
import { WorkflowStageBadge } from "./task/workflow-stage-badge";
import { TaskActions } from "./task/task-actions";

export default function TaskCard({ task }: { task: ExtendedTask }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();

  // Fetch workflow and stage information if they exist but not provided
  const { data: workflow } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${task.workflowId}`],
    enabled: !!task.workflowId && !task.workflow,
  });

  const { data: stage } = useQuery<WorkflowStage>({
    queryKey: [`/api/workflows/${task.workflowId}/stages/${task.stageId}`],
    enabled: !!task.workflowId && !!task.stageId && !task.stage,
  });

  // Use provided or fetched workflow/stage
  const displayWorkflow = task.workflow || workflow;
  const displayStage = task.stage || stage;

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
            <TaskStatusBadge status={task.status as TaskStatus} />
            
            {displayWorkflow && displayStage && (
              <WorkflowStageBadge 
                workflowName={displayWorkflow.name}
                stageName={displayStage.name}
                stageColor={displayStage.color || undefined}
              />
            )}
          </div>
          
          <TaskActions 
            taskId={task.id} 
            currentStatus={task.status as TaskStatus}
            onOpenTaskDetail={() => setDetailOpen(true)}
          />
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
          workflow: displayWorkflow,
          stage: displayStage,
        }}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}