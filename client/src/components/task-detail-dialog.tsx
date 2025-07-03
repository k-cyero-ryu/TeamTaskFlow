import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Task, Subtask, TaskStep, Workflow, WorkflowStage } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import TaskComments from "./task-comments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSubtasks, useTaskSteps } from "@/hooks/use-task-items";
import { useTasks } from "@/hooks/use-tasks";
import { ExtendedTask } from "@/lib/types";
import { ErrorBoundary } from "./error-boundary";
import { handleQueryError } from "@/lib/error-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Loader2, CheckCircle2, Calendar, Clipboard, Users, Edit2, X, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

// Extended Task is now imported from lib/types

interface TaskDetailDialogProps {
  task: ExtendedTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Component for editing due date
function DueDateEditor({ task }: { task: ExtendedTask }) {
  const [isEditing, setIsEditing] = useState(false);
  const [dateValue, setDateValue] = useState(
    task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : ""
  );
  const { user } = useAuth();
  const { updateTaskDueDate, getTaskById } = useTasks();
  const { toast } = useToast();

  // Get the latest task data from the cache to ensure we have the most up-to-date info
  const latestTask = getTaskById(task.id) || task;

  // Update local date value when task.dueDate changes (from WebSocket updates)
  useEffect(() => {
    console.log('DueDateEditor: Task due date changed to:', latestTask.dueDate);
    setDateValue(latestTask.dueDate ? format(new Date(latestTask.dueDate), "yyyy-MM-dd") : "");
  }, [latestTask.dueDate]);

  // Check if user can edit due date (task responsible or creator)
  const canEditDueDate = user && (task.responsibleId === user.id || task.creatorId === user.id);

  const handleSave = async () => {
    try {
      const newDueDate = dateValue ? new Date(dateValue) : null;
      
      // Validate date if provided
      if (newDueDate && isNaN(newDueDate.getTime())) {
        toast({
          title: "Invalid Date",
          description: "Please enter a valid date",
          variant: "destructive",
        });
        return;
      }

      await updateTaskDueDate.mutateAsync({
        taskId: task.id,
        dueDate: newDueDate,
      });

      setIsEditing(false);
    } catch (error) {
      // Error is already handled by the mutation
    }
  };

  const handleCancel = () => {
    setDateValue(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
    setIsEditing(false);
  };

  if (!canEditDueDate) {
    // Show read-only view for users who can't edit
    return latestTask.dueDate ? (
      <div>
        <h3 className="text-sm font-medium mb-2">Due Date</h3>
        <p className="text-muted-foreground">
          {format(new Date(latestTask.dueDate), "PPP")}
        </p>
      </div>
    ) : (
      <div>
        <h3 className="text-sm font-medium mb-2">Due Date</h3>
        <p className="text-muted-foreground">No due date set</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
        Due Date
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        )}
      </h3>
      
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="w-40"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateTaskDueDate.isPending}
            className="h-8 w-8 p-0"
          >
            {updateTaskDueDate.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={updateTaskDueDate.isPending}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {latestTask.dueDate ? format(new Date(latestTask.dueDate), "PPP") : "No due date set"}
        </p>
      )}
    </div>
  );
}

// Wrap the main component with error boundary
export default function TaskDetailDialog(props: TaskDetailDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        aria-labelledby="task-detail-title"
        aria-describedby="task-detail-description"
      >
        <ErrorBoundary
          fallback={<TaskDetailErrorState task={props.task} onClose={() => props.onOpenChange(false)} />}
          showToast={false} // Contained in dialog, so no need for toast
        >
          <TaskDetailContent task={props.task} />
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

// Error fallback component
function TaskDetailErrorState({ task, onClose }: { task: ExtendedTask; onClose: () => void }) {
  return (
    <div className="py-6 space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Error Loading Task Details
        </DialogTitle>
        <DialogDescription>
          We encountered a problem while loading the complete task details.
        </DialogDescription>
      </DialogHeader>
      
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Unable to load complete task details. Some information might be missing or unavailable.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-2">
        <h3 className="font-medium">Basic Task Information</h3>
        <p><span className="font-medium">Title:</span> {task.title}</p>
        {task.description && (
          <p><span className="font-medium">Description:</span> {task.description}</p>
        )}
        <p><span className="font-medium">Status:</span> {task.status}</p>
      </div>
      
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button 
          variant="default" 
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reload Page
        </Button>
      </div>
    </div>
  );
}

// Loading skeleton for task detail sections
function TaskDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

// Main content component with error handling
function TaskDetailContent({ task }: { task: ExtendedTask }) {
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<number | null>(null);
  const [updatingStepId, setUpdatingStepId] = useState<number | null>(null);
  const [updateErrors, setUpdateErrors] = useState<{
    subtask?: string;
    step?: string;
  }>({});
  
  const { toast } = useToast();
  
  // Fetch workflow data if needed
  const { 
    data: workflow, 
    isLoading: isWorkflowLoading,
    error: workflowError
  } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${task.workflowId}`],
    enabled: !!task.workflowId && !task.workflow,
    retry: 2,
  });

  // Fetch stage data if needed
  const { 
    data: stage, 
    isLoading: isStageLoading,
    error: stageError
  } = useQuery<WorkflowStage>({
    queryKey: [`/api/workflows/${task.workflowId}/stages/${task.stageId}`],
    enabled: !!task.workflowId && !!task.stageId && !task.stage,
    retry: 2,
  });

  // Show error toast for data loading errors
  useEffect(() => {
    if (workflowError) {
      const errorMessage = handleQueryError(workflowError);
      toast({
        title: "Error loading workflow",
        description: errorMessage || "Could not load workflow information.",
        variant: "destructive",
      });
    }
    if (stageError) {
      const errorMessage = handleQueryError(stageError);
      toast({
        title: "Error loading stage",
        description: errorMessage || "Could not load stage information.",
        variant: "destructive",
      });
    }
  }, [workflowError, stageError, toast]);
  
  // Use provided or fetched workflow/stage
  const displayWorkflow = task.workflow || workflow;
  const displayStage = task.stage || stage;
  
  // Use custom hooks for subtasks and steps
  const { updateSubtaskStatus } = useSubtasks(task.id);
  const { updateStepStatus } = useTaskSteps(task.id);
  
  // Check for loading states
  const isLoading = (task.workflowId && !task.workflow && isWorkflowLoading) || 
                    (task.stageId && !task.stage && isStageLoading);
                    
  // Check for data errors
  const hasDataErrors = workflowError || stageError;
  
  // Handle subtask update with error handling
  const handleSubtaskUpdate = (subtaskId: number, completed: boolean) => {
    setUpdatingSubtaskId(subtaskId);
    setUpdateErrors(prev => ({ ...prev, subtask: undefined }));
    
    updateSubtaskStatus.mutate(
      { id: subtaskId, completed },
      {
        onSuccess: () => {
          // Optionally show success toast here
        },
        onError: (error) => {
          const errorMessage = handleQueryError(error);
          setUpdateErrors(prev => ({ 
            ...prev, 
            subtask: errorMessage || "Failed to update subtask"
          }));
          toast({
            title: "Error updating subtask",
            description: errorMessage || "There was a problem updating the subtask status.",
            variant: "destructive",
          });
        },
        onSettled: () => {
          setUpdatingSubtaskId(null);
        }
      }
    );
  };
  
  // Handle step update with error handling
  const handleStepUpdate = (stepId: number, completed: boolean) => {
    setUpdatingStepId(stepId);
    setUpdateErrors(prev => ({ ...prev, step: undefined }));
    
    updateStepStatus.mutate(
      { id: stepId, completed },
      {
        onSuccess: () => {
          // Optionally show success toast here
        },
        onError: (error) => {
          const errorMessage = handleQueryError(error);
          setUpdateErrors(prev => ({ 
            ...prev, 
            step: errorMessage || "Failed to update step"
          }));
          toast({
            title: "Error updating step",
            description: errorMessage || "There was a problem updating the step status.",
            variant: "destructive",
          });
        },
        onSettled: () => {
          setUpdatingStepId(null);
        }
      }
    );
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle id="task-detail-title" className="text-2xl">{task.title}</DialogTitle>
          <div className="flex gap-2">
            <Badge
              variant="secondary"
              className={cn(
                task.status === "todo"
                  ? "bg-slate-500"
                  : task.status === "in-progress"
                  ? "bg-blue-500"
                  : "bg-green-500"
              )}
            >
              {task.status}
            </Badge>
            
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (displayWorkflow && displayStage) ? (
              <Badge
                variant="outline"
                style={{
                  borderColor: displayStage.color || '#4444FF',
                  color: displayStage.color || '#4444FF'
                }}
              >
                {displayWorkflow.name} - {displayStage.name}
              </Badge>
            ) : hasDataErrors ? (
              <Badge variant="outline" className="border-destructive text-destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Data Error
              </Badge>
            ) : null}
          </div>
        </div>
        
        {hasDataErrors && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>
              Some workflow or stage information couldn't be loaded. Basic task functionality is still available.
            </AlertDescription>
          </Alert>
        )}
        
        <DialogDescription id="task-detail-description" className="mt-2">
          View and manage task details, progress tracking, and collaboration features
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="details">
        <TabsList className="grid w-full grid-cols-2" aria-label="Task information tabs">
          <TabsTrigger id="details-tab-trigger" value="details" aria-controls="details-tab">
            <span className="flex items-center gap-1">
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Details
            </span>
          </TabsTrigger>
          <TabsTrigger id="comments-tab-trigger" value="comments" aria-controls="comments-tab">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" aria-hidden="true" />
              Comments
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent id="details-tab" value="details" className="space-y-6" role="tabpanel" aria-labelledby="details-tab-trigger">
          {task.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">{task.description}</p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Created</h3>
              <p className="text-muted-foreground">
                {format(new Date(task.createdAt), "PPP")}
              </p>
            </div>
            <DueDateEditor task={task} />
          </div>

          <Separator />

          <div className="space-y-4">
            {displayWorkflow && (
              <div>
                <h3 className="text-lg font-semibold">Workflow</h3>
                <p className="text-muted-foreground">{displayWorkflow.name}</p>
                {displayWorkflow.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {displayWorkflow.description}
                  </p>
                )}
              </div>
            )}
            {displayStage && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold">Current Stage</h3>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="px-3 py-1 rounded-md text-sm font-medium"
                    style={{
                      backgroundColor: displayStage.color || '#4444FF',
                      color: '#fff'
                    }}
                  >
                    {displayStage.name}
                  </div>
                </div>
                {displayStage.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {displayStage.description}
                  </p>
                )}
              </div>
            )}
          </div>
          <Separator />

          {task.participants && task.participants.length > 0 && (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-3">Participants</h3>
                <div className="flex flex-wrap gap-2">
                  {task.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 bg-secondary p-2 rounded-lg"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>
                          {participant.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{participant.username}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {task.subtasks && task.subtasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Subtasks
                    {updateErrors.subtask && (
                      <span className="text-destructive ml-2">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                  </CardTitle>
                  {updateErrors.subtask && (
                    <CardDescription className="text-destructive">
                      {updateErrors.subtask}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <div className="relative">
                        <Checkbox
                          id={`subtask-${subtask.id}`}
                          checked={subtask.completed}
                          disabled={updatingSubtaskId === subtask.id}
                          onCheckedChange={(checked) => {
                            handleSubtaskUpdate(subtask.id, checked as boolean);
                          }}
                          className="transition-opacity duration-200"
                          style={{
                            opacity: updatingSubtaskId === subtask.id ? 0.5 : 1,
                          }}
                        />
                        {updatingSubtaskId === subtask.id && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                          </div>
                        )}
                      </div>
                      <label
                        htmlFor={`subtask-${subtask.id}`}
                        className={`${
                          subtask.completed ? "line-through text-muted-foreground" : ""
                        } transition-all duration-200 cursor-pointer`}
                      >
                        {subtask.title}
                      </label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {task.steps && task.steps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Steps
                    {updateErrors.step && (
                      <span className="text-destructive ml-2">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                  </CardTitle>
                  {updateErrors.step && (
                    <CardDescription className="text-destructive">
                      {updateErrors.step}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.steps
                    .sort((a, b) => a.order - b.order)
                    .map((step) => (
                      <div key={step.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Checkbox
                              id={`step-${step.id}`}
                              checked={step.completed}
                              disabled={updatingStepId === step.id}
                              onCheckedChange={(checked) => {
                                handleStepUpdate(step.id, checked as boolean);
                              }}
                              className="transition-opacity duration-200"
                              style={{
                                opacity: updatingStepId === step.id ? 0.5 : 1,
                              }}
                            />
                            {updatingStepId === step.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                              </div>
                            )}
                          </div>
                          <label
                            htmlFor={`step-${step.id}`}
                            className={`font-medium ${
                              step.completed ? "line-through text-muted-foreground" : ""
                            } transition-all duration-200 cursor-pointer`}
                          >
                            {step.title}
                          </label>
                        </div>
                        {step.description && (
                          <p className="text-sm text-muted-foreground ml-6">
                            {step.description}
                          </p>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent id="comments-tab" value="comments" role="tabpanel" aria-labelledby="comments-tab-trigger">
          <TaskComments taskId={task.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}