import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type User, type Workflow, type WorkflowStage } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, CalendarIcon, X, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorBoundary } from "./error-boundary";
import { handleQueryError } from "@/lib/error-utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function CreateTaskDialog() {
  return (
    <ErrorBoundary fallback={<CreateTaskErrorState />}>
      <CreateTaskDialogContent />
    </ErrorBoundary>
  );
}

function CreateTaskErrorState() {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div>
      <Button 
        variant="destructive" 
        className="flex items-center gap-2" 
        onClick={() => setShowDetails(!showDetails)}
        aria-expanded={showDetails}
        aria-label="Show error details about task creation"
      >
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>Task Creation Unavailable</span>
      </Button>
      
      {showDetails && (
        <Dialog open={true} onOpenChange={() => setShowDetails(false)}>
          <DialogContent
            aria-labelledby="error-dialog-title"
            aria-describedby="error-dialog-description"
          >
            <DialogHeader>
              <DialogTitle id="error-dialog-title" className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                System Error
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <p id="error-dialog-description" className="text-sm text-muted-foreground mb-2">
                There was a problem initializing the task creation functionality. This is likely a temporary issue.
              </p>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Task Creation Unavailable</AlertTitle>
                <AlertDescription>
                  We encountered a problem with the task creation system. This could be due to a connection issue 
                  or a temporary server problem.
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDetails(false)}
                  aria-label="Close error dialog"
                >
                  <span>Close</span>
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="gap-2"
                  aria-label="Reload page to retry"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Reload Page</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateTaskDialogContent() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: stages = [] } = useQuery<WorkflowStage[]>({
    queryKey: [`/api/workflows/${selectedWorkflowId}/stages`],
    enabled: !!selectedWorkflowId,
  });

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      responsibleId: null,
      priority: "medium",
      participantIds: [],
      subtasks: [],
      steps: [],
      dueDate: null,
      workflowId: null,
      stageId: null,
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (form.getValues("workflowId") && form.getValues("stageId")) {
        queryClient.invalidateQueries({ 
          queryKey: [
            `/api/workflows/${form.getValues("workflowId")}/stages/${form.getValues("stageId")}/tasks`
          ] 
        });
      }
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      const errorMessage = handleQueryError(error);
      toast({
        title: "Error Creating Task",
        description: errorMessage || "An unexpected error occurred while creating the task.",
        variant: "destructive",
      });
      
      // Log error for debugging
      console.error("Task creation error:", error);
    },
  });

  function onSubmit(data: InsertTask) {
    createTaskMutation.mutate(data);
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
        <Button aria-label="Create a new task">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>New Task</span>
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-labelledby="create-task-title"
        aria-describedby="create-task-description"
      >
        <DialogHeader>
          <DialogTitle id="create-task-title">Create New Task</DialogTitle>
          <p id="create-task-description" className="text-sm text-muted-foreground">
            Fill out the form below to create a new task with details, subtasks, steps and workflow assignment.
          </p>
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
                          <SelectValue placeholder="Select priority" />
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
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="participantIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participants</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const id = parseInt(value);
                      const currentIds = field.value || [];
                      if (!currentIds.includes(id)) {
                        field.onChange([...currentIds, id]);
                      }
                    }}
                    value=""
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Add participants" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(field.value || []).map((id) => {
                      const user = users.find((u) => u.id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md"
                        >
                          <span>{user?.username}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() =>
                              field.onChange(field.value?.filter((v) => v !== id))
                            }
                            aria-label={`Remove participant ${user?.username || ''}`}
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <FormLabel>Subtasks</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addSubtask}
                  aria-label="Add a new subtask"
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> 
                  <span>Add Subtask</span>
                </Button>
              </div>
              {form.watch("subtasks")?.map((subtask, index) => (
                <div key={index} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`subtasks.${index}.title`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input {...field} placeholder="Subtask title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubtask(index)}
                    aria-label={`Remove subtask ${index + 1}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <FormLabel>Steps</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addStep}
                  aria-label="Add a new step"
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> 
                  <span>Add Step</span>
                </Button>
              </div>
              {form.watch("steps")?.map((step, index) => (
                <div key={index} className="space-y-2 border p-4 rounded-lg">
                  <div className="flex justify-between items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`steps.${index}.title`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} placeholder="Step title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStep(index)}
                      aria-label={`Remove step ${index + 1}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
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
                            placeholder="Step description"
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

            <FormField
              control={form.control}
              name="responsibleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsible Person</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select responsible person" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Add Workflow Selection */}
            <FormField
              control={form.control}
              name="workflowId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const id = parseInt(value);
                      field.onChange(id);
                      setSelectedWorkflowId(id);
                      // Reset stage when workflow changes
                      form.setValue("stageId", null);
                    }}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select workflow" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workflows.map((workflow) => (
                        <SelectItem key={workflow.id} value={workflow.id.toString()}>
                          {workflow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Add Stage Selection */}
            {selectedWorkflowId && (
              <FormField
                control={form.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id.toString()}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {createTaskMutation.error && (
              <Alert 
                variant="destructive" 
                className="mb-4"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Error Creating Task</AlertTitle>
                <AlertDescription>
                  {handleQueryError(createTaskMutation.error)}
                </AlertDescription>
              </Alert>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={createTaskMutation.isPending}
              aria-busy={createTaskMutation.isPending}
              aria-label={createTaskMutation.isPending ? "Creating task, please wait..." : "Create task"}
            >
              {createTaskMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Creating Task...</span>
                </span>
              ) : (
                "Create Task"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}