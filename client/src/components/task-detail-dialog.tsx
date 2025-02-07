import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Task, Subtask, TaskStep } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  steps?: TaskStep[];
  participants?: { username: string; id: number }[];
  responsible?: { username: string; id: number };
}

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
  const { toast } = useToast();
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<number | null>(null);
  const [updatingStepId, setUpdatingStepId] = useState<number | null>(null);

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      setUpdatingSubtaskId(id);
      const res = await apiRequest("PATCH", `/api/subtasks/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Subtask updated",
        description: "The subtask status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating subtask",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingSubtaskId(null);
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      setUpdatingStepId(id);
      const res = await apiRequest("PATCH", `/api/steps/${id}/status`, {
        completed,
      });
      const data = await res.json();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Step updated",
        description: "The step status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating step",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingStepId(null);
    },
  });

  const statusColors = {
    todo: "bg-slate-500",
    "in-progress": "bg-blue-500",
    done: "bg-green-500",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">{task.title}</DialogTitle>
            <Badge
              variant="secondary"
              className={`${
                statusColors[task.status as keyof typeof statusColors]
              }`}
            >
              {task.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {task.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">{task.description}</p>
            </div>
          )}

          <Separator />

          {/* Task Details */}
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
            {task.responsibleId && (
              <div>
                <h3 className="text-sm font-medium mb-2">Responsible Person</h3>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>
                      {task.responsible?.username?.[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">
                    {task.responsible?.username}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Participants */}
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

          {/* Progress Tracking */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Subtasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-2"
                    >
                      <div className="relative">
                        <Checkbox
                          checked={subtask.completed}
                          disabled={updatingSubtaskId === subtask.id}
                          onCheckedChange={(checked) =>
                            updateSubtaskMutation.mutate({
                              id: subtask.id,
                              completed: checked as boolean,
                            })
                          }
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
                      <span
                        className={`${
                          subtask.completed ? "line-through text-muted-foreground" : ""
                        } transition-all duration-200`}
                      >
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Steps */}
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
                              checked={step.completed}
                              disabled={updatingStepId === step.id}
                              onCheckedChange={(checked) =>
                                updateStepMutation.mutate({
                                  id: step.id,
                                  completed: checked as boolean,
                                })
                              }
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
                          <span
                            className={`font-medium ${
                              step.completed ? "line-through text-muted-foreground" : ""
                            } transition-all duration-200`}
                          >
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}