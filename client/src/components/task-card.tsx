import { useState, memo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Task, Workflow, WorkflowStage } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import TaskDetailDialog from "./task-detail-dialog";
import { cn } from "@/lib/utils";
import { ExtendedTask, TaskStatus } from "@/lib/types";
import { TaskStatusBadge } from "./task/task-status-badge";
import { WorkflowStageBadge } from "./task/workflow-stage-badge";
import { TaskActions } from "./task/task-actions";
import EditTaskDialog from "./edit-task-dialog";
import { ErrorBoundary } from "./error-boundary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Using higher-order component for error boundaries
export default function TaskCard({ task }: { task: ExtendedTask }) {
  return (
    <ErrorBoundary 
      fallback={<TaskCardError task={task} />}
      showToast={false} // We'll handle errors gracefully in the UI without a toast
    >
      <TaskCardContent task={task} />
    </ErrorBoundary>
  );
}

// Error fallback component for TaskCard
function TaskCardError({ task }: { task: ExtendedTask }) {
  return (
    <Card 
      className="border-destructive/30 bg-destructive/5"
      role="alert"
      aria-labelledby="error-task-title"
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <h3 id="error-task-title" className="font-semibold text-sm">Error Loading Task</h3>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          {task?.title || "Task"}
        </p>
        <Alert className="mt-2" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs">
            Unable to load some task data. Try refreshing the page.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for workflow and stage data
function TaskCardSkeleton() {
  return (
    <div 
      className="flex gap-2 items-center" 
      aria-busy="true"
      aria-label="Loading workflow and stage information"
    >
      <Skeleton className="h-5 w-24" aria-hidden="true" />
      <Skeleton className="h-5 w-36" aria-hidden="true" />
    </div>
  );
}

// Main card content with error-handled data fetching, wrapped in memo for performance
const TaskCardContent = memo(function TaskCardContent({ task }: { task: ExtendedTask }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user } = useAuth();

  // Fetch workflow and stage information if they exist but not provided
  const { 
    data: workflow, 
    isLoading: isWorkflowLoading,
    error: workflowError
  } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${task.workflowId}`],
    enabled: !!task.workflowId && !task.workflow,
    retry: 2, // Limit retries for failed requests
    staleTime: 60000, // 1 minute stale time to prevent too many fetches in virtualized list
    gcTime: 300000, // 5 minutes before query is garbage collected
  });

  const { 
    data: stage, 
    isLoading: isStageLoading,
    error: stageError 
  } = useQuery<WorkflowStage>({
    queryKey: [`/api/workflows/${task.workflowId}/stages/${task.stageId}`],
    enabled: !!task.workflowId && !!task.stageId && !task.stage,
    retry: 2, // Limit retries for failed requests
    staleTime: 60000, // 1 minute stale time to prevent too many fetches in virtualized list
    gcTime: 300000, // 5 minutes before query is garbage collected
  });

  // Use provided or fetched workflow/stage
  const displayWorkflow = task.workflow || workflow;
  const displayStage = task.stage || stage;

  // Calculate completion metrics
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSteps = task.steps?.length || 0;
  const completedSteps = task.steps?.filter((s) => s.completed).length || 0;

  // Show skeletons while loading related data
  const isLoading = (task.workflowId && !task.workflow && isWorkflowLoading) || 
                    (task.stageId && !task.stage && isStageLoading);
  
  // Show error states for related data
  const hasRelatedDataError = workflowError || stageError;

  return (
    <>
      <Card 
        className={cn(
          "hover:bg-secondary/50 cursor-pointer transition-all duration-300",
          isTransitioning && "scale-[0.98] opacity-80",
          hasRelatedDataError && "border-destructive/30"
        )}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          // Open task details on Enter or Space key press
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`View details for task: ${task.title}`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex gap-2">
            <TaskStatusBadge status={task.status as TaskStatus} />
            
            {isLoading ? (
              <TaskCardSkeleton />
            ) : displayWorkflow && displayStage ? (
              <WorkflowStageBadge 
                workflowName={displayWorkflow.name}
                stageName={displayStage.name}
                stageColor={displayStage.color || undefined}
              />
            ) : hasRelatedDataError ? (
              <span 
                className="text-xs text-destructive flex items-center gap-1"
                role="alert"
                aria-label="Workflow data could not be loaded"
              >
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                <span>Data Error</span>
              </span>
            ) : null}
          </div>
          
          <TaskActions 
            taskId={task.id} 
            currentStatus={task.status as TaskStatus}
            onOpenTaskDetail={() => setDetailOpen(true)}
            onOpenTaskEdit={() => setEditOpen(true)}
            task={task}
          />
        </CardHeader>

        <CardContent>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-semibold" id={`task-title-${task.id}`}>{task.title}</h3>
              {task.description && (
                <p 
                  className="text-sm text-muted-foreground line-clamp-2"
                  aria-describedby={`task-title-${task.id}`}
                >
                  {task.description}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="mt-4 space-y-2">
            {totalSubtasks > 0 && (
              <p className="text-sm text-muted-foreground">
                Subtasks: {completedSubtasks}/{totalSubtasks} completed
                <span className="sr-only">
                  , {Math.round((completedSubtasks / totalSubtasks) * 100)}% of subtasks completed
                </span>
              </p>
            )}
            {totalSteps > 0 && (
              <p className="text-sm text-muted-foreground">
                Steps: {completedSteps}/{totalSteps} completed
                <span className="sr-only">
                  , {Math.round((completedSteps / totalSteps) * 100)}% of steps completed
                </span>
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="flex items-center space-x-4">
            <Avatar 
              className="h-8 w-8"
              aria-label={task.responsible?.username ? `Assigned to ${task.responsible.username}` : "Unassigned"}
            >
              <AvatarFallback aria-hidden="true">
                {task.responsible?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {task.responsible ? `Assigned to: ${task.responsible.username}` : "Unassigned"}
              </div>
              <p className="text-sm">
                Due {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No date"}
                {task.dueDate && (
                  <span className="sr-only">
                    , which is on {format(new Date(task.dueDate), "MMMM do, yyyy")}
                  </span>
                )}
              </p>
            </div>
          </div>
          {task.participants && task.participants.length > 0 && (
            <div 
              className="flex -space-x-2"
              aria-label={`${task.participants.length} task participants`}
            >
              {task.participants.slice(0, 3).map((participant) => (
                <Avatar 
                  key={participant.id} 
                  className="h-8 w-8 border-2 border-background"
                  aria-label={`Participant: ${participant.username}`}
                >
                  <AvatarFallback aria-hidden="true">
                    {participant.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {task.participants.length > 3 && (
                <div 
                  className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs"
                  aria-label={`Plus ${task.participants.length - 3} more participants`}
                >
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
      
      {editOpen && (
        <EditTaskDialog 
          task={{
            ...task,
            workflow: displayWorkflow,
            stage: displayStage,
          }}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to determine if the component should re-render
  // Optimized for virtualized lists to reduce unnecessary renders
  
  // If the task IDs are different, we definitely need to re-render
  if (prevProps.task.id !== nextProps.task.id) return false;
  
  // Shallow compare critical task properties that affect visual appearance
  if (
    prevProps.task.status !== nextProps.task.status ||
    prevProps.task.title !== nextProps.task.title ||
    prevProps.task.description !== nextProps.task.description ||
    prevProps.task.dueDate !== nextProps.task.dueDate
  ) return false;
  
  // Check workflow and stage IDs rather than the full objects
  if (
    prevProps.task.workflowId !== nextProps.task.workflowId || 
    prevProps.task.stageId !== nextProps.task.stageId
  ) return false;
  
  // Only check subtasks and steps count for virtualized rendering optimization
  // This is a performance vs. accuracy tradeoff specifically for virtualized lists
  const prevSubtasksCount = prevProps.task.subtasks?.length || 0;
  const nextSubtasksCount = nextProps.task.subtasks?.length || 0;
  const prevCompletedSubtasks = prevProps.task.subtasks?.filter(s => s.completed).length || 0;
  const nextCompletedSubtasks = nextProps.task.subtasks?.filter(s => s.completed).length || 0;
  
  const prevStepsCount = prevProps.task.steps?.length || 0;
  const nextStepsCount = nextProps.task.steps?.length || 0;
  const prevCompletedSteps = prevProps.task.steps?.filter(s => s.completed).length || 0;
  const nextCompletedSteps = nextProps.task.steps?.filter(s => s.completed).length || 0;
  
  if (
    prevSubtasksCount !== nextSubtasksCount ||
    prevCompletedSubtasks !== nextCompletedSubtasks ||
    prevStepsCount !== nextStepsCount ||
    prevCompletedSteps !== nextCompletedSteps
  ) return false;
  
  // Check if participants array has changed length 
  // (we don't do deep comparison for performance reasons)
  if (
    (prevProps.task.participants?.length || 0) !== (nextProps.task.participants?.length || 0)
  ) return false;
  
  // Don't re-render if none of the above conditions are met
  return true;
});