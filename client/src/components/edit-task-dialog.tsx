import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Minus, X, Edit2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { useTasks } from "@/hooks/use-tasks";
import { useToast } from "@/hooks/use-toast";
import { insertTaskSchema } from "@shared/schema";
import type { InsertTask, User, Workflow, WorkflowStage } from "@shared/schema";
import type { ExtendedTask } from "@/lib/types";
// import UserSelector from "./user-selector"; // Not needed - using custom checkbox approach
import { ErrorBoundary } from "./error-boundary";
import { handleQueryError } from "@/lib/error-utils";
import { format } from "date-fns";
// import { useI18n } from "@/i18n"; // Simplified for now

interface EditTaskDialogProps {
  task: ExtendedTask;
  trigger?: React.ReactNode;
}

export default function EditTaskDialog({ task, trigger }: EditTaskDialogProps) {
  return (
    <ErrorBoundary fallback={<EditTaskErrorState />}>
      <EditTaskDialogContent task={task} trigger={trigger} />
    </ErrorBoundary>
  );
}

function EditTaskErrorState() {
  return (
    <div className="p-4 text-center">
      <p className="text-destructive mb-2">Something went wrong with the edit task form.</p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Reload Page
      </Button>
    </div>
  );
}

function EditTaskDialogContent({ task, trigger }: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateTask } = useTasks();
  const { toast } = useToast();
  // const { t } = useI18n(); // Simplified for now

  // Fetch users for participant selection
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    retry: 2,
  });

  // Fetch workflows for workflow selection
  const { data: workflows, isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
    retry: 2,
  });

  // Fetch stages for selected workflow
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(task.workflowId);
  const { data: stages, isLoading: stagesLoading } = useQuery<WorkflowStage[]>({
    queryKey: [`/api/workflows/${selectedWorkflowId}/stages`],
    enabled: !!selectedWorkflowId,
    retry: 2,
  });

  // Set up form with task data
  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description || "",
      responsibleId: task.responsibleId,
      priority: task.priority,
      participantIds: task.participants?.map((p: any) => p.id) || [],
      subtasks: task.subtasks?.map((s: any) => ({ title: s.title })) || [],
      steps: task.steps?.map((s: any) => ({ title: s.title, description: s.description || "", order: s.order })) || [],
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      workflowId: task.workflowId,
      stageId: task.stageId,
    },
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        responsibleId: task.responsibleId,
        priority: task.priority,
        participantIds: task.participants?.map((p: any) => p.id) || [],
        subtasks: task.subtasks?.map((s: any) => ({ title: s.title })) || [],
        steps: task.steps?.map((s: any) => ({ title: s.title, description: s.description || "", order: s.order })) || [],
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        workflowId: task.workflowId,
        stageId: task.stageId,
      });
      setSelectedWorkflowId(task.workflowId);
    }
  }, [task, form]);

  const updateTaskMutation = {
    mutate: (data: InsertTask) => updateTask.mutate({ taskId: task.id, updates: data }),
    isPending: updateTask.isPending
  };

  function onSubmit(data: InsertTask) {
    // Ensure dueDate is properly formatted before sending to server
    const formattedData = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null
    };
    
    updateTaskMutation.mutate(formattedData);
    
    // Close dialog on successful update
    if (!updateTask.isPending) {
      setOpen(false);
    }
  }

  const addSubtask = () => {
    const subtasks = form.getValues("subtasks") || [];
    form.setValue("subtasks", [...subtasks, { title: "" }]);
  };

  const removeSubtask = (index: number) => {
    const subtasks = form.getValues("subtasks") || [];
    form.setValue(
      "subtasks",
      subtasks.filter((_, i) => i !== index)
    );
  };

  const addStep = () => {
    const steps = form.getValues("steps") || [];
    form.setValue("steps", [
      ...steps,
      { title: "", description: "", order: steps.length },
    ]);
  };

  const removeStep = (index: number) => {
    const steps = form.getValues("steps") || [];
    form.setValue(
      "steps",
      steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order: i }))
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" aria-label="Edit task">
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="edit-task-dialog-description"
      >
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <div id="edit-task-dialog-description" className="sr-only">
            Edit task details including title, description, priority, participants, subtasks, and workflow settings.
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={
                              "w-full pl-3 text-left font-normal"
                            }
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsibleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsible</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : parseInt(value))
                      }
                      value={field.value ? field.value.toString() : "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Responsible" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Responsible</SelectItem>
                        {usersLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading users...
                          </SelectItem>
                        ) : (
                          users?.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="participantIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participants</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        {users?.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`participant-${user.id}`}
                              checked={(field.value || []).includes(user.id)}
                              onChange={(e) => {
                                const currentIds = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...currentIds, user.id]);
                                } else {
                                  field.onChange(currentIds.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <label htmlFor={`participant-${user.id}`} className="text-sm">
                              {user.username}
                            </label>
                          </div>
                        ))}
                        {usersLoading && <div className="text-sm text-muted-foreground">Loading users...</div>}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Workflow and Stage Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="workflowId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const workflowId = value === "none" ? null : parseInt(value);
                        field.onChange(workflowId);
                        setSelectedWorkflowId(workflowId);
                        // Reset stage when workflow changes
                        form.setValue("stageId", null);
                      }}
                      value={field.value ? field.value.toString() : "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Workflow" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Workflow</SelectItem>
                        {workflowsLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading workflows...
                          </SelectItem>
                        ) : (
                          workflows?.map((workflow) => (
                            <SelectItem key={workflow.id} value={workflow.id.toString()}>
                              {workflow.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? null : parseInt(value))
                      }
                      value={field.value ? field.value.toString() : "none"}
                      disabled={!selectedWorkflowId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Stage</SelectItem>
                        {stagesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading stages...
                          </SelectItem>
                        ) : (
                          stages?.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id.toString()}>
                              {stage.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Subtasks Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Subtasks</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSubtask}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Subtask
                </Button>
              </div>
              {form.watch("subtasks")?.map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`subtasks.${index}.title`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Subtask Title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSubtask(index)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Steps Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Steps</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>
              {form.watch("steps")?.map((_, index) => (
                <div key={index} className="space-y-2 p-3 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`steps.${index}.title`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Step Title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={`steps.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Step Description"
                            className="min-h-[60px]"
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={updateTaskMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTaskMutation.isPending}
              >
                {updateTaskMutation.isPending ? "Updating..." : "Update Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}