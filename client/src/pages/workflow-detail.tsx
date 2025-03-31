import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertWorkflowStageSchema,
  type InsertWorkflowStage,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import CreateTaskDialog from "@/components/create-task-dialog";
import TaskList from "@/components/task-list";
import { useWorkflow } from "@/hooks/use-workflows";
import { useTasks } from "@/hooks/use-tasks";

export default function WorkflowDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const workflowId = parseInt(params.id!);

  // Use custom hooks for data fetching
  const { workflow, stages = [], isLoading: workflowLoading, createStage } = useWorkflow(workflowId);
  
  const { tasks = [], isLoading: tasksLoading, updateTaskStage } = useTasks({ 
    workflowId 
  });

  const form = useForm<InsertWorkflowStage>({
    resolver: zodResolver(insertWorkflowStageSchema),
    defaultValues: {
      name: "",
      description: "",
      order: stages?.length || 0,
      color: "#4444FF",
      metadata: null,
    },
  });

  if (workflowLoading || tasksLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!workflow) {
    return <div className="flex items-center justify-center min-h-screen">Workflow not found</div>;
  }

  const tasksByStage = tasks.reduce<Record<number, typeof tasks[0][]>>((acc, task) => {
    if (task.stageId) {
      if (!acc[task.stageId]) {
        acc[task.stageId] = [];
      }
      acc[task.stageId].push(task);
    }
    return acc;
  }, {});

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Stage Creation Form - Moved to top */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                createStage.mutate({ ...data, order: stages.length });
                form.reset();
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input type="color" {...field} value={field.value || '#4444FF'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
              >
                Add Stage
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
          <p className="text-muted-foreground">{workflow.description}</p>
        </div>
        <CreateTaskDialog />
      </div>

      {/* Stages List - Full width */}
      <div className="w-full space-y-6"> {/* Added w-full for full width */}
        <h2 className="text-xl font-semibold">Workflow Stages</h2>
        {stages.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No stages created yet. Add a stage to get started.
          </div>
        ) : (
          stages.map((stage) => (
            <Card key={stage.id} className="w-full"> {/* Added w-full for full width */}
              <div className="mb-4"> {/* Added margin for spacing */}
                {/* Stage Actions - Moved above content */}
                <div className="flex gap-2 overflow-x-auto">
                  {stages
                    .filter((targetStage) => targetStage.id !== stage.id)
                    .map((targetStage) => (
                      <Button
                        key={targetStage.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const tasksInCurrentStage = tasksByStage[stage.id] || [];
                          tasksInCurrentStage.forEach(task => {
                            updateTaskStage.mutate({
                              taskId: task.id,
                              stageId: targetStage.id,
                            });
                          });
                        }}
                      >
                        Move all to {targetStage.name}
                      </Button>
                    ))}
                </div>
              </div>
              <CardContent className="pt-4"> {/* Adjusted padding */}
                {/* Stage Content */}
                <div
                  className="border rounded-lg p-4 w-full"
                  style={{
                    borderLeftColor: stage.color || '#4444FF',
                    borderLeftWidth: '4px'
                  }}
                >
                  <h3 className="font-medium text-lg">{stage.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stage.description}
                  </p>
                  <div className="mt-4">
                    {tasksByStage[stage.id]?.length ? (
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium">Tasks</h4>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({tasksByStage[stage.id].length})
                          </span>
                        </div>
                        <div className="bg-background rounded">
                          {/* Transform tasks to add stage and workflow info for optimized rendering */}
                          <TaskList 
                            tasks={tasksByStage[stage.id].map(task => ({
                              ...task,
                              workflow: workflow,
                              stage: stage
                            }))}
                            isLoading={false}
                            error={null}
                            limit={3} // Show only 3 with pagination
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-2">
                        No tasks in this stage
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}