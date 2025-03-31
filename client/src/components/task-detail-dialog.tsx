import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { ExtendedTask } from "@/lib/types";

// Extended Task is now imported from lib/types

interface TaskDetailDialogProps {
  task: ExtendedTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<number | null>(null);
  const [updatingStepId, setUpdatingStepId] = useState<number | null>(null);
  
  // Fetch workflow data if needed
  const { data: workflow } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${task.workflowId}`],
    enabled: !!task.workflowId && !task.workflow,
  });

  // Fetch stage data if needed
  const { data: stage } = useQuery<WorkflowStage>({
    queryKey: [`/api/workflows/${task.workflowId}/stages/${task.stageId}`],
    enabled: !!task.workflowId && !!task.stageId && !task.stage,
  });
  
  // Use provided or fetched workflow/stage
  const displayWorkflow = task.workflow || workflow;
  const displayStage = task.stage || stage;
  
  // Use custom hooks for subtasks and steps
  const { updateSubtaskStatus } = useSubtasks(task.id);
  const { updateStepStatus } = useTaskSteps(task.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{task.title}</DialogTitle>
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
              {(displayWorkflow && displayStage) && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: displayStage.color || '#4444FF',
                    color: displayStage.color || '#4444FF'
                  }}
                >
                  {displayWorkflow.name} - {displayStage.name}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
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
              {task.dueDate && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Due Date</h3>
                  <p className="text-muted-foreground">
                    {format(new Date(task.dueDate), "PPP")}
                  </p>
                </div>
              )}
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
                    <CardTitle className="text-lg">Subtasks</CardTitle>
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
                              setUpdatingSubtaskId(subtask.id);
                              updateSubtaskStatus.mutate({
                                id: subtask.id,
                                completed: checked as boolean,
                              }, {
                                onSettled: () => setUpdatingSubtaskId(null)
                              });
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
                    <CardTitle className="text-lg">Steps</CardTitle>
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
                                  setUpdatingStepId(step.id);
                                  updateStepStatus.mutate({
                                    id: step.id,
                                    completed: checked as boolean,
                                  }, {
                                    onSettled: () => setUpdatingStepId(null)
                                  });
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

          <TabsContent value="comments">
            <TaskComments taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}