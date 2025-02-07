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

interface ExtendedTask extends Task {
  subtasks?: Subtask[];
  steps?: TaskStep[];
  participants?: { username: string; id: number }[];
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
          {/* Task Description */}
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
                      <span
                        className={`${
                          subtask.completed ? "line-through text-muted-foreground" : ""
                        }`}
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
                          <Checkbox
                            checked={step.completed}
                            onCheckedChange={(checked) =>
                              updateStepMutation.mutate({
                                id: step.id,
                                completed: checked as boolean,
                              })
                            }
                          />
                          <span
                            className={`font-medium ${
                              step.completed ? "line-through text-muted-foreground" : ""
                            }`}
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
