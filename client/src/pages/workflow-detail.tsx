import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  type WorkflowStage,
  type Workflow,
  type Task,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CreateTaskDialog from "@/components/create-task-dialog";
import { Plus } from "lucide-react";

export default function WorkflowDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const workflowId = parseInt(params.id!);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // WebSocket setup
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        if (data.type === "workflow_stage_update" && data.workflowId === workflowId) {
          console.log("Invalidating stages query");
          queryClient.invalidateQueries({ 
            queryKey: ['/api/workflows', workflowId, 'stages']
          });
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setSocket(ws);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [workflowId]);

  const { data: workflow, isLoading: isWorkflowLoading } = useQuery<Workflow>({
    queryKey: [`/api/workflows/${workflowId}`],
  });

  const { data: stages = [], isLoading: isStagesLoading } = useQuery<WorkflowStage[]>({
    queryKey: ['/api/workflows', workflowId, 'stages'],
  });

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', { workflowId }],
    select: (data) => {
      const filteredTasks = data.filter(task => task.workflowId === workflowId);
      console.log('Filtered tasks for workflow:', filteredTasks);
      return filteredTasks;
    },
    enabled: !!stages?.length,
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

  const createStageMutation = useMutation({
    mutationFn: async (data: InsertWorkflowStage) => {
      const response = await apiRequest("POST", `/api/workflows/${workflowId}/stages`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', workflowId, 'stages'] });
      toast({
        title: "Success",
        description: "Stage created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      console.error("Stage creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create stage",
        variant: "destructive",
      });
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, stageId }: { taskId: number; stageId: number }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}/stage`, { stageId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tasks', { workflowId }]
      });
      toast({
        title: "Success",
        description: "Task moved successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Task movement error:", error);
      toast({
        title: "Error",
        description: "Failed to move task",
        variant: "destructive",
      });
    },
  });

  if (isWorkflowLoading || isStagesLoading || isTasksLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!workflow) {
    return <div className="flex items-center justify-center min-h-screen">Workflow not found</div>;
  }

  const tasksByStage = tasks.reduce<Record<number, Task[]>>((acc, task) => {
    if (task.stageId) {
      if (!acc[task.stageId]) {
        acc[task.stageId] = [];
      }
      acc[task.stageId].push(task);
    }
    return acc;
  }, {});

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{workflow.name}</h1>
            <p className="text-muted-foreground">{workflow.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createStageMutation.mutate(data)
                )}
                className="space-y-4"
              >
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createStageMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createStageMutation.isPending ? "Creating..." : "Add Stage"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stages.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No stages created yet. Add a stage to get started.
                </div>
              ) : (
                stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="p-4 border rounded-lg"
                    style={{
                      borderLeftColor: stage.color || '#4444FF',
                      borderLeftWidth: '4px'
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{stage.name}</h3>
                        {stage.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {stage.description}
                          </p>
                        )}
                      </div>
                      <CreateTaskDialog workflowId={workflowId} stageId={stage.id} />
                    </div>
                    <div className="mt-4 space-y-2">
                      {tasksByStage[stage.id]?.length ? (
                        tasksByStage[stage.id].map((task) => (
                          <div
                            key={task.id}
                            className="bg-background p-3 rounded border"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{task.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {task.description}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                {stages.map((targetStage) =>
                                  targetStage.id !== stage.id ? (
                                    <Button
                                      key={targetStage.id}
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        moveTaskMutation.mutate({
                                          taskId: task.id,
                                          stageId: targetStage.id,
                                        })
                                      }
                                      disabled={moveTaskMutation.isPending}
                                    >
                                      Move to {targetStage.name}
                                    </Button>
                                  ) : null
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-muted-foreground py-2">
                          No tasks in this stage
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}